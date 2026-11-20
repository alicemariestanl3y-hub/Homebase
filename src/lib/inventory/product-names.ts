/**
 * Clean, searchable product names while keeping retailer originals
 * (often stored in notes as "Woolworths: …") for matching.
 */

const HOUSE_BRAND_PREFIX =
  /^(woolworths|macro|essentials|gold|odp|own brand)\s+/i;

const PACK_SIZE_SUFFIX =
  /\s*[-–,]?\s*\d+(?:\.\d+)?\s*(?:kg|g|ml|l|pk|pack|packs)\s*$/i;

/** Prefer a short readable label for lists and search indexing. */
export function displayProductName(name: string): string {
  let cleaned = name.replace(/\s*\n+\s*/g, " ").trim();
  cleaned = cleaned.replace(HOUSE_BRAND_PREFIX, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || name.trim();
}

/** Pull retailer original from notes when present. */
export function originalRetailerName(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/Woolworths:\s*([^·]+)/i);
  const value = match?.[1]?.trim();
  return value || null;
}

/** Aliases used for client-side inventory search. */
export function productSearchAliases(
  name: string,
  notes: string | null | undefined,
): string[] {
  const aliases = new Set<string>();
  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    aliases.add(trimmed.toLowerCase());
    aliases.add(displayProductName(trimmed).toLowerCase());
    // Without pack-size suffix for looser matching ("milk" vs "Milk 2L")
    aliases.add(
      displayProductName(trimmed).replace(PACK_SIZE_SUFFIX, "").trim().toLowerCase(),
    );
  };

  push(name);
  push(originalRetailerName(notes));
  if (notes) {
    for (const part of notes.split("·")) {
      const cleaned = part.replace(/^(Woolworths|Brand|Pack|Paid|Added via)[^:]*:\s*/i, "").trim();
      push(cleaned);
    }
  }

  return [...aliases].filter(Boolean);
}

export function matchesProductQuery(
  name: string,
  notes: string | null | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return productSearchAliases(name, notes).some((alias) => alias.includes(q));
}

/** Local unit memory keyed by normalised product name. */
const UNIT_MEMORY_KEY = "hb.unit-memory.v1";

export function rememberedUnitForProduct(
  name: string,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UNIT_MEMORY_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[normalizeUnitMemoryKey(name)] ?? null;
  } catch {
    return null;
  }
}

export function rememberUnitForProduct(name: string, unit: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(UNIT_MEMORY_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    map[normalizeUnitMemoryKey(name)] = unit;
    window.localStorage.setItem(UNIT_MEMORY_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function normalizeUnitMemoryKey(name: string): string {
  return displayProductName(name)
    .toLowerCase()
    .replace(PACK_SIZE_SUFFIX, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Guess a sensible default unit from the product name (prefer g/kg for weight). */
export function guessDefaultUnit(name: string): string {
  const haystack = name.toLowerCase();
  if (/\bml\b/.test(haystack)) return "ml";
  if (/\b\d+(\.\d+)?\s?l\b/.test(haystack) || /\bl\b/.test(haystack)) {
    return "L";
  }
  if (/\bkg\b/.test(haystack)) return "kg";
  if (/\bg\b/.test(haystack)) return "g";
  if (/\b(can|cans)\b/.test(haystack)) return "cans";
  if (/\b(bottle|bottles)\b/.test(haystack)) return "bottles";
  if (/\b(packet|packets|pack|pk)\b/.test(haystack)) return "packets";
  // Weight-leaning staples without an explicit unit → grams
  if (
    /\b(flour|sugar|rice|pasta|oats|mince|chicken|beef|lamb|cheese|butter|yoghurt|yogurt)\b/.test(
      haystack,
    )
  ) {
    return "g";
  }
  return "pieces";
}
