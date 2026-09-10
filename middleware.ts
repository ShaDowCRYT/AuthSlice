import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Centralized route protection for /dashboard.
// An expired or missing session redirects to /signin.
// Full implementation in step 4.
export function middleware(request: NextRequest) {
  // Placeholder — will check session cookie and validate against DB
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
