import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import type { ProductKind } from "@/lib/packaged-meals/types";

/**
 * One candidate product extracted from a photo by the vision model.
 * Uncertain fields stay null / flagged — we never invent expiry dates.
 */
export type CapturedCandidate = {
  id: string;
  name: string;
  brand: string | null;
  packageSize: string | null;
  quantity: number;
  unit: InventoryUnit;
  /** Only when clearly readable on packaging — never guessed. */
  expiresOn: string | null;
  suggestedLocation: LocationType;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  notes: string | null;
  sourceImageIndex: number;
  /** Set during review when matching an existing inventory row. */
  mergeWithItemId?: string | null;
  selected?: boolean;
  /** Set by packaged-meal normalisation after vision. */
  suggestedProductKind?: ProductKind;
  recognitionReason?: string;
  isPackagedMealProduct?: boolean;
};

export type CaptureAnalyzeResponse = {
  candidates: CapturedCandidate[];
  model: string;
  imageCount: number;
  warning?: string;
};

export type DuplicateMatch = {
  itemId: string;
  itemName: string;
  locationType: LocationType;
  quantity: number;
  unit: InventoryUnit;
  score: number;
};

/** One inventory row written by Smart Capture (returned to the client). */
export type SavedCaptureItem = {
  inventoryItemId: string;
  catalogProductId: string | null;
  name: string;
  productKind: ProductKind | null;
  isPackagedMealProduct: boolean;
  packageSize: string | null;
  brand: string | null;
};
