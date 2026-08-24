import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/api/client";

/**
 * Presence-only check — just short-circuits a flash of protected content
 * for a logged-out visitor. The backend independently rejects every
 * request with an invalid/expired/inactive-user token regardless, so this
 * is a UX nicety, not the actual authorization boundary.
 */
export function proxy(request: NextRequest) {
  const hasToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (!hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
