"use client";

import { useActionState } from "react";
import { signup } from "@/lib/auth/signup";
import { signupSchema } from "@/lib/schemas/auth";
import Link from "next/link";

type SignupState = { error: string } | { success: true } | null;

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(
    async (prev: SignupState, formData: FormData): Promise<SignupState> => {
      const raw = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      };
      const parsed = signupSchema.safeParse(raw);
      if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
      }
      return signup(prev, formData);
    },
    null
  );

  const isSuccess = state && "success" in state;
  const isError = state && "error" in state;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Create Account</h1>

        {isError && (
          <div
            role="alert"
            className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {isSuccess && (
          <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700 text-center">
            Account created! Check your email for the verification code.{" "}
            <Link href="/verify" className="underline font-medium">
              Verify now
            </Link>
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

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1"
              >
                Password
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
              {pending ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-600">
          Already have an account?{" "}
          <Link href="/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
