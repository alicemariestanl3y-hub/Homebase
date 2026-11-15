/**
 * Supabase connection settings (server-only names).
 *
 * Use Project URL + publishable/anon key only.
 * Never put the secret service-role key in the app or in git.
 * Do not use NEXT_PUBLIC_* aliases — those would ship to the browser.
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
  const rawUrl = clean(process.env.SUPABASE_URL);
  const anonKey =
    clean(process.env.SUPABASE_ANON_KEY) ||
    clean(process.env.SUPABASE_PUBLISHABLE_KEY);

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

export function getOpenAiApiKey(): string | null {
  return clean(process.env.OPENAI_API_KEY);
}
