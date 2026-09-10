import { redirect } from "next/navigation";

// No landing page — redirect straight to sign in.
// This is explicitly out of scope per PRD.md.
export default function RootPage() {
  redirect("/signin");
}
