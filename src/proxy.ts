import { NextResponse, type NextRequest } from "next/server";
import { isPublicApiPath } from "@/lib/supabase/proxy-helpers";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy (replaces middleware.ts).
 * Runs before matched routes to refresh Supabase auth and gate pages.
 *
 * Skip session refresh for:
 * - Server Actions (`next-action` header): cookie clearing / redirects can
 *   break the action protocol so the handler never runs (no Auth log).
 * - `/api/auth/*`: signup/signin must reach the route handler and set
 *   session cookies without the proxy wiping them first.
 */
export async function proxy(request: NextRequest) {
  const isServerAction =
    request.headers.has("next-action") ||
    request.headers.has("Next-Action");
  const isAuthApi = isPublicApiPath(request.nextUrl.pathname);

  if (isServerAction || isAuthApi) {
    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimization.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
