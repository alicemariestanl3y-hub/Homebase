import type { CapturedCandidate } from "@/lib/capture/types";
import type { InventoryUnit } from "@/lib/inventory/types";
import { recognizePackagedMealProduct } from "./recognize";
import type { ProductKind } from "./types";

export type NormalizedCaptureCandidate = CapturedCandidate & {
  suggestedProductKind: ProductKind;
  recognitionReason: string;
  /** True when this should be stocked as whole packets, not net weight. */
  isPackagedMealProduct: boolean;
};

/**
 * Recipe bases / kits / cooking sauces are whole packets in inventory.
 * "30g" is pack size metadata — not quantity 30 of grams.
 */
export function normalizeCaptureCandidate(
  candidate: CapturedCandidate,
): NormalizedCaptureCandidate {
  const recognition = recognizePackagedMealProduct({
    name: candidate.name,
    brand: candidate.brand,
    notes: [candidate.notes, candidate.packageSize].filter(Boolean).join(" "),
  });

  const isPackagedMealProduct =
    recognition.suggestedKind === "recipe_base" ||
    recognition.suggestedKind === "meal_kit" ||
    recognition.suggestedKind === "cooking_sauce";

  if (!isPackagedMealProduct) {
    return {
      ...candidate,
      suggestedProductKind: recognition.suggestedKind,
      recognitionReason: recognition.reason,
      isPackagedMealProduct: false,
    };
  }

  const packetCount = inferPacketCount(candidate);
  const packageSize =
    candidate.packageSize ||
    inferPackageSizeFromWeightUnit(candidate) ||
    null;

  return {
    ...candidate,
    quantity: packetCount,
    unit: "packets" as InventoryUnit,
    packageSize,
    suggestedLocation: candidate.suggestedLocation || "pantry",
    needsReview: true,
    notes: mergeNotes(candidate.notes, recognition.reason),
    suggestedProductKind: recognition.suggestedKind,
    recognitionReason: recognition.reason,
    isPackagedMealProduct: true,
  };
}

export function normalizeCaptureCandidates(
  candidates: CapturedCandidate[],
): NormalizedCaptureCandidate[] {
  return candidates.map(normalizeCaptureCandidate);
}

function inferPacketCount(candidate: CapturedCandidate): number {
  // If vision already used packets/pieces/cans/bottles with a small count, keep it.
  if (
    (candidate.unit === "packets" ||
      candidate.unit === "pieces" ||
      candidate.unit === "cans" ||
      candidate.unit === "bottles") &&
    candidate.quantity > 0 &&
    candidate.quantity <= 12
  ) {
    return candidate.quantity;
  }
  // Weight/volume on a recipe base is almost always net contents, not stock qty.
  return 1;
}

function inferPackageSizeFromWeightUnit(
  candidate: CapturedCandidate,
): string | null {
  if (
    (candidate.unit === "g" ||
      candidate.unit === "kg" ||
      candidate.unit === "ml" ||
      candidate.unit === "L") &&
    candidate.quantity > 0
  ) {
    const display =
      Number.isInteger(candidate.quantity)
        ? String(candidate.quantity)
        : String(candidate.quantity);
    return `${display}${candidate.unit}`;
  }
  return null;
}

function mergeNotes(
  existing: string | null,
  recognitionReason: string,
): string | null {
  const parts = [existing, `Classified: ${recognitionReason}`].filter(Boolean);
  return parts.join(" · ") || null;
}
