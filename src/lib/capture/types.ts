import type { InventoryUnit, LocationType } from "@/lib/inventory/types";

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
