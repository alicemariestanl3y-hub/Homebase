/** Pure helpers for the auth proxy — unit-tested without Next request objects. */

export function isBenignSessionError(error: {
  message?: string;
  name?: string;
  status?: number;
}): boolean {
  const message = (error.message ?? "").toLowerCase();
  const name = (error.name ?? "").toLowerCase();
  return (
    name.includes("authsessionmissing") ||
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("refresh token") ||
    message.includes("not authenticated") ||
    error.status === 401
  );
}

export function isAuthRoutePath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/signup");
}

export function isPublicApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/status") ||
    pathname.startsWith("/api/capture/") ||
    pathname.startsWith("/api/auth/")
  );
}
