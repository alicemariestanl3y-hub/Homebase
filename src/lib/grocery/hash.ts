import { createHash } from "node:crypto";

/** Stable fingerprint so the same order/list is not imported twice. */
export function hashGroceryContent(parts: string[]): string {
  const normalized = parts
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}
