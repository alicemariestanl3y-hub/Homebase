import { connection } from "next/server";
import { NextResponse } from "next/server";
import { probeSupabaseAuthHealth } from "@/lib/supabase/auth-health";
import { getSupabasePublicStatus } from "@/lib/supabase/env";

/**
 * Lightweight health check for published-app troubleshooting.
 * Never returns secret values. Always reads env at request time.
 */
export async function GET() {
  await connection();
  const supabase = getSupabasePublicStatus();
  const auth = await probeSupabaseAuthHealth();

  return NextResponse.json({
    ok: true,
    supabaseConfigured: supabase.configured,
    supabaseHost: supabase.host,
    supabaseReason: supabase.reason,
    hasUrl: supabase.hasUrl,
    hasAnonKey: supabase.hasAnonKey,
    urlOk: supabase.urlOk,
    keyLooksLikeJwt: supabase.keyLooksLikeJwt,
    authReachable: auth.reachable,
    authStatus: auth.status,
    authDetail: auth.detail,
  });
}
