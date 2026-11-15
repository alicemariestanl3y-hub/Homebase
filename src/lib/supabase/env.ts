/**
 * Supabase connection settings.
 *
 * Use the Project URL + publishable/anon key only.
 * Never put the secret service-role key in the app or in git.
 *
 * Accepted names (first match wins):
 * - SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY /
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *
 * Auth + data access stay on the server (RSC / Server Actions) with RLS.
 */
export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.replace(/\/+$/, ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const rawUrl =
    clean(process.env.SUPABASE_URL) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey =
    clean(process.env.SUPABASE_ANON_KEY) ||
    clean(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!rawUrl || !anonKey) return null;

  const url = normalizeUrl(rawUrl);
  if (!url) return null;

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** Safe diagnostics for health checks — never includes secret values. */
export function getSupabasePublicStatus() {
  const env = getSupabaseEnv();
  if (!env) {
    return { configured: false as const, host: null };
  }
  try {
    return { configured: true as const, host: new URL(env.url).host };
  } catch {
    return { configured: false as const, host: null };
  }
}
