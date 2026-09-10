"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/reset";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    async (
      prev: { error: string } | { success: true } | null,
      formData: FormData
    ): Promise<{ error: string } | { success: true } | null> => {
      const email = formData.get("email") as string;
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
      }
      return requestPasswordReset(null, formData);
    },
    null
  );

  const isSuccess = state && "success" in state;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Forgot Password</h1>

        {state && "error" in state && (
          <div
            role="alert"
            className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {isSuccess && (
          <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
            If an account exists for that email, a reset link has been sent.
          </div>
        )}

        {!isSuccess && (
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
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {pending ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-sm text-center">
          <Link href="/signin" className="text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}