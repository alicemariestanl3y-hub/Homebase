/**
 * Supabase connection settings (server-only names).
 *
 * Use Project URL + publishable/anon key only.
 * Never put the secret service-role key in the app or in git.
 * Do not use NEXT_PUBLIC_* aliases — those would ship to the browser
 * and Cursor App Secrets refuse that prefix.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigReason =
  | "ok"
  | "missing_url"
  | "missing_key"
  | "invalid_url"
  | "key_too_short";

/**
 * Read process.env at runtime through bracket access so bundlers cannot
 * replace the lookup with an empty build-time value.
 */
function readProcessEnv(name: string): string | undefined {
  const bag: NodeJS.ProcessEnv = process.env;
  const value = bag[name];
  return typeof value === "string" ? value : undefined;
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  let trimmed = value.trim();
  // Strip wrapping quotes people often paste from dashboards.
  trimmed = trimmed.replace(/^['"]|['"]$/g, "");
  // Allow pasting a full "NAME=value" line by mistake.
  const assigned = trimmed.match(/^[A-Z][A-Z0-9_]*=([\s\S]*)$/);
  if (assigned) {
    trimmed = assigned[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(raw: string): string | null {
  const candidate =
    raw.match(/https?:\/\/[^\s"'<>]+/i)?.[0]?.replace(/\/+$/, "") ??
    raw.replace(/\/+$/, "");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Supabase project URLs are https://<ref>.supabase.co
    return url.origin;
  } catch {
    return null;
  }
}

function readRawUrl(): string | null {
  return (
    clean(readProcessEnv("SUPABASE_URL")) ||
    clean(readProcessEnv("SUPABASE_PROJECT_URL"))
  );
}

function readRawAnonKey(): string | null {
  return (
    clean(readProcessEnv("SUPABASE_ANON_KEY")) ||
    clean(readProcessEnv("SUPABASE_PUBLISHABLE_KEY")) ||
    clean(readProcessEnv("SUPABASE_KEY"))
  );
}

export function diagnoseSupabaseEnv(): {
  reason: SupabaseConfigReason;
  hasUrl: boolean;
  hasAnonKey: boolean;
  urlOk: boolean;
  keyLooksLikeJwt: boolean;
  relatedEnvNames: string[];
} {
  const rawUrl = readRawUrl();
  const rawKey = readRawAnonKey();
  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  const relatedEnvNames = Object.keys(process.env)
    .filter((name) => /supabase/i.test(name))
    .sort();

  const hasUrl = Boolean(rawUrl);
  const hasAnonKey = Boolean(rawKey);
  const urlOk = Boolean(url);
  const keyLooksLikeJwt = Boolean(rawKey && rawKey.length > 20);

  let reason: SupabaseConfigReason = "ok";
  if (!hasUrl) reason = "missing_url";
  else if (!urlOk) reason = "invalid_url";
  else if (!hasAnonKey) reason = "missing_key";
  else if (!keyLooksLikeJwt) reason = "key_too_short";

  return {
    reason,
    hasUrl,
    hasAnonKey,
    urlOk,
    keyLooksLikeJwt,
    relatedEnvNames,
  };
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const rawUrl = readRawUrl();
  const anonKey = readRawAnonKey();
  if (!rawUrl || !anonKey) return null;

  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  if (anonKey.length < 20) return null;

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** Safe diagnostics for health checks — never includes secret values. */
export function getSupabasePublicStatus() {
  const diagnosis = diagnoseSupabaseEnv();
  const env = getSupabaseEnv();

  return {
    configured: env !== null,
    host: env ? new URL(env.url).host : null,
    reason: diagnosis.reason,
    hasUrl: diagnosis.hasUrl,
    hasAnonKey: diagnosis.hasAnonKey,
    urlOk: diagnosis.urlOk,
    keyLooksLikeJwt: diagnosis.keyLooksLikeJwt,
    relatedEnvNames: diagnosis.relatedEnvNames,
  };
}

export function getOpenAiApiKey(): string | null {
  return clean(readProcessEnv("OPENAI_API_KEY"));
}

export function supabaseConfigUserMessage(reason: SupabaseConfigReason): string {
  switch (reason) {
    case "ok":
      return "";
    case "missing_url":
      return "SUPABASE_URL is missing in App Secrets.";
    case "missing_key":
      return "SUPABASE_ANON_KEY is missing in App Secrets.";
    case "invalid_url":
      return "SUPABASE_URL doesn’t look like a Project URL (use https://YOUR_REF.supabase.co).";
    case "key_too_short":
      return "SUPABASE_ANON_KEY looks incomplete. Paste the full anon/publishable key.";
  }
}
