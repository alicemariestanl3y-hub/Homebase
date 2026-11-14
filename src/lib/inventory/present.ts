import { expiryUrgency, formatExpiryLabel } from "./expiry";
import type { InventoryItem, InventoryItemView } from "./types";

/**
 * Attach expiry labels on the server (request time).
 * Client components must not call `new Date()` during prerender under
 * Next.js Cache Components — so we compute urgency here and pass it down.
 */
export function toItemView(item: InventoryItem, now: Date): InventoryItemView {
  return {
    ...item,
    expiryLabel: formatExpiryLabel(item.expiresOn, now),
    urgency: expiryUrgency(item.expiresOn, now),
  };
}

export function toItemViews(
  items: InventoryItem[],
  now: Date,
): InventoryItemView[] {
  return items.map((item) => toItemView(item, now));
}
