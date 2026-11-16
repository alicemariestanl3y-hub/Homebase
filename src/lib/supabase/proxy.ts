import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import {
  isAuthRoutePath,
  isBenignSessionError,
  isPublicApiPath,
} from "./proxy-helpers";

/**
 * Refresh the auth session on each matched request (Next.js 16 Proxy).
 * Also redirects unauthenticated users away from the inventory when
 * Supabase is configured.
 *
 * Important: never let Supabase network/config failures become an unhandled
 * 500 on every route — fall back to the login screen with a safe error flag.
 */

function clearSupabaseCookies(
  request: NextRequest,
  response: NextResponse,
): void {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase")
    ) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  // Demo mode: no Supabase secrets → leave the sample inventory public.
  if (!env) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isAuthRoute = isAuthRoutePath(path);
  const isPublicApi = isPublicApiPath(path);

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
      // Missing/expired session is normal when signed out — don't scare the user.
      if (isBenignSessionError(error)) {
        if (!isAuthRoute && !isPublicApi) {
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.search = "";
          const redirect = NextResponse.redirect(url);
          clearSupabaseCookies(request, redirect);
          return redirect;
        }
        clearSupabaseCookies(request, supabaseResponse);
        return supabaseResponse;
      }

      // Real config/API failures (bad key, paused project, etc.).
      if (!isAuthRoute && !isPublicApi) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "supabase_auth");
        const redirect = NextResponse.redirect(url);
        clearSupabaseCookies(request, redirect);
        return redirect;
      }
      clearSupabaseCookies(request, supabaseResponse);
      return supabaseResponse;
    }

    if (!user && !isAuthRoute && !isPublicApi) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    if (isAuthRoute || isPublicApi) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "supabase_unreachable");
    return NextResponse.redirect(url);
  }
}
