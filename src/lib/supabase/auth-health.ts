import { getSupabaseEnv } from "./env";

/**
 * Probe whether the configured Supabase Auth endpoint accepts the anon key.
 * Never logs or returns secret values.
 */
export async function probeSupabaseAuthHealth(): Promise<{
  reachable: boolean;
  status: number | null;
  detail: string;
}> {
  const env = getSupabaseEnv();
  if (!env) {
    return {
      reachable: false,
      status: null,
      detail: "not_configured",
    };
  }

  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    return {
      reachable: response.ok,
      status: response.status,
      detail: response.ok ? "ok" : `http_${response.status}`,
    };
  } catch {
    return {
      reachable: false,
      status: null,
      detail: "network_error",
    };
  }
}
