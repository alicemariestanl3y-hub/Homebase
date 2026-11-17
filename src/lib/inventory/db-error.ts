/** Turn Supabase/Postgrest error shapes into a normal Error with a useful message. */
export function toDbError(
  error: unknown,
  fallback: string,
): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const row = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [row.message, row.details, row.hint, row.code]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) return new Error(parts.join(" — "));
  }
  return new Error(fallback);
}

export function throwDbError(error: unknown, fallback: string): never {
  throw toDbError(error, fallback);
}
