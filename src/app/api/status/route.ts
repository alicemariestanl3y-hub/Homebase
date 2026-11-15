import { NextResponse } from "next/server";
import { getSupabasePublicStatus } from "@/lib/supabase/env";

/**
 * Lightweight health check for published-app troubleshooting.
 * Never returns secret values.
 */
export async function GET() {
  const supabase = getSupabasePublicStatus();

  return NextResponse.json({
    ok: true,
    supabaseConfigured: supabase.configured,
    supabaseHost: supabase.host,
  });
}
