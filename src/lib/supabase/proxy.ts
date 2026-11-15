import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Refresh the auth session on each matched request (Next.js 16 Proxy).
 * Also redirects unauthenticated users away from the inventory when
 * Supabase is configured.
 *
 * Important: never let Supabase network/config failures become an unhandled
 * 500 on every route — fall back to the login screen with a safe error flag.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  // Demo mode: no Supabase secrets → leave the sample inventory public.
  if (!env) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") || path.startsWith("/signup");

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Invalid key / project paused / network — treat as signed out.
      if (!isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "supabase_auth");
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    if (!user && !isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    if (isAuthRoute) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "supabase_unreachable");
    return NextResponse.redirect(url);
  }
}
