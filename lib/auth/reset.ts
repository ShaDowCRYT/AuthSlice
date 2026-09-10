"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/schemas/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";
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

export async function sendResetEmail(
  email: string,
  token: string
): Promise<void> {
  const transport = await getTransporter();
  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  const info = await transport.sendMail({
    from: "AuthSlice <noreply@authslice.dev>",
    to: email,
    subject: "Reset your password",
    text: `Click this link to reset your password: ${resetUrl}. This link expires in 1 hour.`,
    html: `<p>Click <a href="${resetUrl}">this link</a> to reset your password. This link expires in 1 hour.</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("Reset email preview:", previewUrl);
  }
}

export async function requestPasswordReset(
  _prevState: { error: string } | { success: true } | null,
  formData: FormData
): Promise<{ error: string } | { success: true } | null> {
  const email = formData.get("email") as string;

  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Rate limit: 2 requests per IP per 15 minutes (email has a direct cost)
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "forgot-password", 2, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  let user: { id: string } | null;
  try {
    user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
  } catch {
    // Never let a raw database exception reach the client
    return { error: "Something went wrong. Please try again." };
  }

  // Always return success even if the user doesn't exist — don't leak which emails have accounts
  if (!user) {
    return { success: true };
  }

  // Invalidate any existing unused tokens
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  try {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, used: false },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  await sendResetEmail(parsed.data.email, token);

  return { success: true };
}

export async function resetPassword(
  _prevState: { error: string } | { success: true } | null,
  formData: FormData
): Promise<{ error: string } | { success: true } | null> {
  const raw = {
    token: formData.get("token") as string,
    password: formData.get("password") as string,
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { token, password } = parsed.data;

  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "reset-password", 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  // Single-use and time-limited: check expiry and used flag in the query itself
  let resetToken: { id: string; userId: string } | null;
  try {
    resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  if (!resetToken) {
    return { error: "Invalid or expired reset link." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
    ]);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}