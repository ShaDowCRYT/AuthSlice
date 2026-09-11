import { getSession, signout } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true, email: true },
  });

  if (!user) {
    redirect("/signin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome, {user.fullName || user.email}
            </p>
          </div>

          <form action={signout}>
            <button
              type="submit"
              className="w-full rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive-hover focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}