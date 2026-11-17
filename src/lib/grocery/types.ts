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

export type GroceryRetailerCode = "woolworths_au" | "other";

export type GroceryCandidate = {
  id: string;
  /** Display / inventory name — usually the original retailer wording. */
  name: string;
  originalName: string | null;
  /** Cleaner name used for recipe / inventory matching. */
  standardizedName: string | null;
  brand: string | null;
  packageSize: string | null;
  quantity: number;
  unit: InventoryUnit;
  unitPrice: number | null;
  linePrice: number | null;
  currency: string;
  suggestedLocation: LocationType;
  lineFulfillment: GroceryLineFulfillment;
  isFood: boolean;
  wasSubstituted: boolean;
  substitutionNote: string | null;
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
  retailerCode: GroceryRetailerCode | null;
  orderReference: string | null;
  currency: string;
  orderTotal: number | null;
  model: string | null;
  parser: "woolworths_html" | "openai_vision" | "openai_text";
  warning?: string;
  duplicateImportId?: string | null;
};

export type GrocerySavePayload = {
  contentHash: string;
  sourceType: GrocerySourceType;
  sourceLabel?: string | null;
  fulfillment: GroceryFulfillment;
  retailer?: string | null;
  retailerCode?: GroceryRetailerCode | null;
  orderReference?: string | null;
  currency?: string;
  orderTotal?: number | null;
  emailMessageId?: string | null;
  requiresApproval?: boolean;
  candidates: GroceryCandidate[];
};
