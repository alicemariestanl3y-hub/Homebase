/**
 * Expiry helpers — pure functions so UI and future agent tools share logic.
 */

export type ExpiryUrgency = "expired" | "soon" | "ok" | "none";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Compare calendar dates in the user's local timezone. */
export function daysUntilExpiry(
  expiresOn: string | null,
  now = new Date(),
): number | null {
  if (!expiresOn) return null;

  const [year, month, day] = expiresOn.split("-").map(Number);
  if (!year || !month || !day) return null;

  const expiryLocal = new Date(year, month - 1, day);
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiryLocal.getTime() - todayLocal.getTime()) / MS_PER_DAY);
}

export function expiryUrgency(
  expiresOn: string | null,
  now = new Date(),
): ExpiryUrgency {
  const days = daysUntilExpiry(expiresOn, now);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}

export function formatExpiryLabel(
  expiresOn: string | null,
  now = new Date(),
): string | null {
  const days = daysUntilExpiry(expiresOn, now);
  if (days === null || !expiresOn) return null;

  if (days < 0) {
    const ago = Math.abs(days);
    return ago === 1 ? "Expired yesterday" : `Expired ${ago} days ago`;
  }
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 7) return `Expires in ${days} days`;

  const [year, month, day] = expiresOn.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `Expires ${date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}
