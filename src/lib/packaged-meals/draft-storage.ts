import type { PacketRecipeDraft } from "./extract-packet-recipe";

const DRAFT_PREFIX = "hb-packet-draft:";
const IMAGES_PREFIX = "hb-packet-images:";

export function storePacketDraft(
  catalogProductId: string,
  draft: PacketRecipeDraft,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${DRAFT_PREFIX}${catalogProductId}`,
      JSON.stringify(draft),
    );
  } catch {
    // Quota / private mode — verify form still works empty.
  }
}

export function readPacketDraft(
  catalogProductId: string,
): PacketRecipeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${DRAFT_PREFIX}${catalogProductId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PacketRecipeDraft;
  } catch {
    return null;
  }
}

export function clearPacketDraft(catalogProductId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${DRAFT_PREFIX}${catalogProductId}`);
    sessionStorage.removeItem(`${IMAGES_PREFIX}${catalogProductId}`);
  } catch {
    // ignore
  }
}

export function storePacketImages(
  catalogProductId: string,
  images: string[],
): void {
  if (typeof window === "undefined") return;
  try {
    // Keep at most 2 images to stay under sessionStorage limits.
    sessionStorage.setItem(
      `${IMAGES_PREFIX}${catalogProductId}`,
      JSON.stringify(images.slice(0, 2)),
    );
  } catch {
    // ignore
  }
}

export function readPacketImages(catalogProductId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`${IMAGES_PREFIX}${catalogProductId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((row): row is string => typeof row === "string")
      : [];
  } catch {
    return [];
  }
}
