"use client";

import { useActionState } from "react";
import { signin } from "@/lib/auth/signin";
import { signinSchema } from "@/lib/schemas/auth";
import Link from "next/link";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(
    async (
      prev: { error: string } | null,
      formData: FormData
    ): Promise<{ error: string } | null> => {
      const raw = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      };
      const parsed = signinSchema.safeParse(raw);
      if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
      }
      return signin(prev, formData);
    },
    null
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign In</h1>

        {state?.error && (
          <div
            role="alert"
            className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {state.error}
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
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {pending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-sm text-center space-y-1">
          <p>
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </p>
          <p>
            New here?{" "}
            <Link href="/signup" className="text-blue-600 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}