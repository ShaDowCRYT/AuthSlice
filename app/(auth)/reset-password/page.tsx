"use client";

import { Suspense, useActionState } from "react";
import { resetPassword } from "@/lib/auth/reset";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, formAction, pending] = useActionState(
    async (
      prev: { error: string } | { success: true } | null,
      formData: FormData
    ): Promise<{ error: string } | { success: true } | null> => {
      const password = formData.get("password") as string;
      const parsed = resetPasswordSchema.safeParse({
        token: formData.get("token") as string,
        password,
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
      }
      return resetPassword(null, formData);
    },
    null
  );

  const isSuccess = state && "success" in state;

  return (
    <div className="w-full max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-center">Reset Password</h1>

      {!token && (
        <p className="text-sm text-center text-red-700 bg-red-50 border border-red-200 rounded p-3">
          Missing reset token. Use the link from your email.
        </p>
      )}

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
          Password reset!{" "}
          <Link href="/signin" className="underline font-medium">
            Sign in
          </Link>
        </div>
      )}

      {token && !isSuccess && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {pending ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<p className="text-sm">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}