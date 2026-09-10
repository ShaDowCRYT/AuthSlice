"use server";

import { prisma } from "@/lib/prisma";
import { verifySchema } from "@/lib/schemas/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<void> {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: "AuthSlice <noreply@authslice.dev>",
    to: email,
    subject: "Your verification code",
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong>. It expires in 10 minutes.</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("Verification email preview:", previewUrl);
  }
}

export async function verifyEmail(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: true } | null> {
  const raw = {
    email: formData.get("email") as string,
    code: formData.get("code") as string,
  };

  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, code } = parsed.data;

  // Rate limit: 3 verifications per IP per 15 minutes
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "verify", 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  let user: { id: string; email: string; emailVerified: boolean } | null;
  try {
    user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { error: "Invalid code or email." };
    }

    // Find code in DB, checking expiry in the query itself (security rule)
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationCode) {
      return { error: "Invalid or expired code." };
    }

    // Mark email as verified and delete the used code
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      prisma.verificationCode.delete({
        where: { id: verificationCode.id },
      }),
    ]);

    return { success: true };
  } catch {
    // Never let a raw database exception reach the client
    return { error: "Something went wrong. Please try again." };
  }
}

export async function resendCode(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | { success: true } | null> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required." };
  }

  // Rate limit: 3 resends per IP per 5 minutes (tightest limit — direct email cost)
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "resend-code", 3, 5 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  let user: { id: string; emailVerified: boolean } | null;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch {
    // Never let a raw database exception reach the client
    return { error: "Something went wrong. Please try again." };
  }

  if (!user) {
    // Don't leak account existence
    return { success: true };
  }

  if (user.emailVerified) {
    return { success: true };
  }

  // Delete old codes and create a new one
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await prisma.verificationCode.deleteMany({
      where: { userId: user.id },
    });

    await prisma.verificationCode.create({
      data: { userId: user.id, code, expiresAt },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  await sendVerificationEmail(email, code);

  return { success: true };
}
