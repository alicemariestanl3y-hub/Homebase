import type { InventoryUnit, LocationType } from "@/lib/inventory/types";

export type GrocerySourceType =
  | "screenshot"
  | "image"
  | "pdf"
  | "pasted_list"
  | "email";

export type GroceryFulfillment = "ordered" | "delivered" | "mixed" | "unknown";
export type GroceryLineFulfillment = "ordered" | "delivered";
export type GroceryImportStatus =
  | "draft"
  | "reviewed"
  | "imported"
  | "cancelled";

export type GroceryCandidate = {
  id: string;
  name: string;
  brand: string | null;
  packageSize: string | null;
  quantity: number;
  unit: InventoryUnit;
  suggestedLocation: LocationType;
  lineFulfillment: GroceryLineFulfillment;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  notes: string | null;
  ingredientKey: string;
  selected?: boolean;
  mergeWithItemId?: string | null;
};

export type GroceryAnalyzeResponse = {
  candidates: GroceryCandidate[];
  contentHash: string;
  fulfillment: GroceryFulfillment;
  retailer: string | null;
  orderReference: string | null;
  model: string;
  warning?: string;
  duplicateImportId?: string | null;
};

export type GrocerySavePayload = {
  contentHash: string;
  sourceType: GrocerySourceType;
  sourceLabel?: string | null;
  fulfillment: GroceryFulfillment;
  retailer?: string | null;
  orderReference?: string | null;
  candidates: GroceryCandidate[];
};
