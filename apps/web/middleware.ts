import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

// Every other sensitive account endpoint (register, password reset,
// change password) is a Route Handler this app owns, so it rate-limits
// itself directly (see apps/web/lib/rate-limit.ts). The one login path
// isn't ours to instrument that way - NextAuth's Credentials provider
// handles POST /api/auth/callback/credentials internally - so it's
// rate-limited here instead, before the request ever reaches NextAuth.
export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/api/auth/callback/credentials" &&
    request.method === "POST"
  ) {
    const ip = clientIpFrom(request);
    // 10 login attempts per 15 minutes per IP - generous for someone who
    // fat-fingers their password a few times, tight enough to make
    // credential-stuffing impractical.
    const limit = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { message: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/auth/callback/credentials",
};
