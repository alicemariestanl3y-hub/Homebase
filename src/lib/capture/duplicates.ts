import type { InventoryItem, LocationType } from "@/lib/inventory/types";
import type { CapturedCandidate, DuplicateMatch } from "./types";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

/** Jaccard similarity on name tokens — cheap duplicate heuristic. */
export function nameSimilarity(a: string, b: string): number {
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

export function findDuplicateMatches(
  candidate: CapturedCandidate,
  items: InventoryItem[],
  locationById: Map<string, LocationType>,
  limit = 3,
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const item of items) {
    const score = nameSimilarity(candidate.name, item.name);
    if (score < 0.45) continue;
    matches.push({
      itemId: item.id,
      itemName: item.name,
      locationType: locationById.get(item.locationId) ?? candidate.suggestedLocation,
      quantity: item.quantity,
      unit: item.unit,
      score,
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
