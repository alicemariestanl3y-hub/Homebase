/**
 * Supabase connection settings.
 *
 * Prefer non-prefixed names (SUPABASE_URL / SUPABASE_ANON_KEY) so secrets can
 * be bound for Cursor Apps. NEXT_PUBLIC_* is accepted as a local-dev alias.
 *
 * The anon key is safe in the browser only with RLS enabled — we still keep
 * auth + data access on the server via Server Actions / RSC where possible.
 */
export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function getSupabaseEnv(): SupabaseEnv | null {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
