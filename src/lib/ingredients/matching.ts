import { convertQuantity, unitDimension } from "@/lib/inventory/units";
import type { InventoryUnit } from "@/lib/inventory/types";

/**
 * Shared ingredient matching for grocery lines, recipe ingredients,
 * and inventory items — so meal planning can subtract stock later.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "and",
  "or",
  "with",
  "fresh",
  "organic",
  "free",
  "range",
]);

/** Collapse display names into a comparable canonical key. */
export function toIngredientKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .sort()
    .join("_");
}

export function tokenSet(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token && !STOP_WORDS.has(token)),
  );
}

/** Jaccard similarity on meaningful tokens (0–1). */
export function ingredientSimilarity(a: string, b: string): number {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export type QuantityMatch = {
  comparable: boolean;
  /** Quantity of `from` expressed in `toUnit` when convertible. */
  convertedQuantity: number | null;
  reason?: string;
};

/**
 * Compare two quantities across units for shopping-list / stock checks.
 * Never invents a conversion — returns comparable:false when unknown.
 */
export function compareQuantities(
  quantity: number,
  fromUnit: InventoryUnit | null | undefined,
  toUnit: InventoryUnit | null | undefined,
): QuantityMatch {
  if (!fromUnit || !toUnit) {
    return {
      comparable: false,
      convertedQuantity: null,
      reason: "Missing unit",
    };
  }
  if (fromUnit === toUnit) {
    return { comparable: true, convertedQuantity: quantity };
  }
  if (unitDimension(fromUnit) !== unitDimension(toUnit)) {
    return {
      comparable: false,
      convertedQuantity: null,
      reason: "Different unit families",
    };
  }
  const converted = convertQuantity(quantity, fromUnit, toUnit);
  if (converted === null) {
    return {
      comparable: false,
      convertedQuantity: null,
      reason: "No conversion defined",
    };
  }
  return { comparable: true, convertedQuantity: converted };
}

export type NamedQuantity = {
  name: string;
  quantity: number;
  unit: InventoryUnit;
};

export type MatchCandidate = NamedQuantity & {
  id: string;
  ingredientKey?: string | null;
};

export type IngredientMatch = {
  id: string;
  name: string;
  score: number;
  quantity: number;
  unit: InventoryUnit;
};

/** Rank inventory (or other) rows that likely match a grocery/recipe name. */
export function findIngredientMatches(
  query: { name: string; ingredientKey?: string | null },
  candidates: MatchCandidate[],
  limit = 5,
  threshold = 0.45,
): IngredientMatch[] {
  const queryKey = query.ingredientKey || toIngredientKey(query.name);
  const matches: IngredientMatch[] = [];

  for (const candidate of candidates) {
    const keyScore =
      candidate.ingredientKey && candidate.ingredientKey === queryKey ? 1 : 0;
    const nameScore = ingredientSimilarity(query.name, candidate.name);
    const score = Math.max(keyScore, nameScore);
    if (score < threshold) continue;
    matches.push({
      id: candidate.id,
      name: candidate.name,
      score,
      quantity: candidate.quantity,
      unit: candidate.unit,
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Scale a recipe ingredient quantity; returns null when quantity unknown. */
export function scaleQuantity(
  quantity: number | null | undefined,
  fromServings: number,
  toServings: number,
): number | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  if (!(fromServings > 0) || !(toServings > 0)) return quantity;
  const scaled = (quantity * toServings) / fromServings;
  // Keep one decimal for readability without inventing precision.
  return Math.round(scaled * 10) / 10;
}
