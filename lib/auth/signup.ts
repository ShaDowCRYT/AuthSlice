"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema } from "@/lib/schemas/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/auth/verify";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function signup(
  _prevState: { error: string } | { success: true } | null,
  formData: FormData
): Promise<{ error: string } | { success: true } | null> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  // Rate limit: 5 signups per IP per 15 minutes
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "signup", 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: { email, passwordHash },
    });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      e.code === "P2002"
    ) {
      // Idempotent: unique constraint violation — account exists, treat as success
    } else {
      return { error: "Something went wrong. Please try again." };
    }
  }

  // Generate and send verification code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.verificationCode.deleteMany({
        where: { userId: user.id },
      });

      await prisma.verificationCode.create({
        data: { userId: user.id, code, expiresAt },
      });

      await sendVerificationEmail(email, code);
    }
  } catch {
    // Never let a raw database exception reach the client
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}
