import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getSupabasePublicStatus } from "@/lib/supabase/env";

/**
 * Lightweight health check for published-app troubleshooting.
 * Never returns secret values. Always reads env at request time.
 */
export async function GET() {
  await connection();
  const supabase = getSupabasePublicStatus();

  return NextResponse.json({
    ok: true,
    supabaseConfigured: supabase.configured,
    supabaseHost: supabase.host,
  });
}
