"use server";

import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { signinSchema } from "@/lib/schemas/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

export async function signin(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = signinSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  // Rate limit: 5 signins per IP per 15 minutes
  const ip = "127.0.0.1";
  const rl = checkRateLimit(ip, "signin", 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same error message for "email not found" and "wrong password" — never leak which emails have accounts
  const invalidMsg = "Invalid email or password.";

  if (!user) {
    // Run a dummy compare to keep timing roughly consistent regardless of whether the user exists
    const DUMMY_HASH =
      "$2b$12$FDJ2LsvWgjpMxCxr8FkmT.4zPOUYpbODZ0JUWG3e3qWrxpNFFSode";
    await comparePassword(password, DUMMY_HASH);
    return { error: invalidMsg };
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return { error: invalidMsg };
  }

  if (!user.emailVerified) {
    return { error: "Please verify your email before signing in." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}