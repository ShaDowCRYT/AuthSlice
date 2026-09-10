"use client";

import { useActionState, useEffect, useState } from "react";
import { verifyEmail, resendCode } from "@/lib/auth/verify";
import { verifySchema } from "@/lib/schemas/auth";
import { useRouter } from "next/navigation";

type VerifyState = { error: string } | { success: true } | null;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const [state, formAction, pending] = useActionState(
    async (prev: VerifyState, formData: FormData): Promise<VerifyState> => {
      const raw = {
        email: formData.get("email") as string,
        code: formData.get("code") as string,
      };
      const parsed = verifySchema.safeParse(raw);
      if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
      }
      return verifyEmail(null, formData);
    },
    null
  );

  const [resendState, resendAction, resendPending] = useActionState(
    async (
      _prev: VerifyState,
      formData: FormData
    ): Promise<VerifyState> => {
      return resendCode(null, formData);
    },
    null
  );

  useEffect(() => {
    if (state && "success" in state) {
      router.push("/signin");
    }
  }, [state, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Verify Email</h1>
        <p className="text-sm text-center text-gray-600">
          Enter the 6-digit code sent to your email address.
        </p>

        {state && "error" in state && (
          <div
            role="alert"
            className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {resendState && "error" in resendState && (
          <div
            role="alert"
            className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {resendState.error}
          </div>
        )}

        {resendState && "success" in resendState && (
          <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            New code sent! Check your email.
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              Verification Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {pending ? "Verifying..." : "Verify"}
          </button>
        </form>

        <form action={resendAction} className="text-center">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resendPending || !email}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {resendPending ? "Sending..." : "Resend code"}
          </button>
        </form>
      </div>
    </main>
  );
}