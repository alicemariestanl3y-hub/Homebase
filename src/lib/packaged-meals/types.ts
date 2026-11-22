import type { InventoryUnit } from "@/lib/inventory/types";

export type ProductKind =
  | "standard"
  | "recipe_base"
  | "meal_kit"
  | "cooking_sauce"
  | "unclassified";

export type RecipeType = "traditional" | "recipe_base" | "meal_kit";

export type AllergenStatus =
  | "unverified"
  | "verified_clear"
  | "contains_restricted"
  | "may_contain";

export type CatalogProduct = {
  id: string;
  householdId: string;
  brand: string | null;
  displayName: string;
  variant: string | null;
  packSize: string | null;
  originalName: string | null;
  productKind: ProductKind;
  kindSuggested: ProductKind | null;
  kindConfirmed: boolean;
  ingredientKey: string;
  identityKey: string;
  allergenStatus: AllergenStatus;
  allergens: string[];
  allergenNotes: string | null;
  allergenVerifiedAt: string | null;
  allergenSource: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  sourceCapturedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PackagedMealIncluded = {
  id: string;
  name: string;
  quantity: number | null;
  unit: InventoryUnit | null;
  ingredientKey: string;
  notes: string | null;
  sortOrder: number;
};

export type PackagedMealDef = {
  id: string;
  householdId: string;
  catalogProductId: string;
  recipeId: string;
  servingsPerPacket: number;
  packetsRequired: number;
  instructions: string | null;
  instructionsVerified: boolean;
  instructionsSource: string | null;
  instructionsCapturedAt: string | null;
  sourceReference: string | null;
  notes: string | null;
  included: PackagedMealIncluded[];
  createdAt: string;
  updatedAt: string;
};

export type HouseholdAllergen = {
  allergenKey: string;
  displayName: string;
  severity: "avoid" | "caution";
};

/** Default household restrictions called out in product requirements. */
export const DEFAULT_HOUSEHOLD_ALLERGENS: HouseholdAllergen[] = [
  { allergenKey: "garlic", displayName: "Garlic", severity: "avoid" },
  { allergenKey: "cashew", displayName: "Cashew", severity: "avoid" },
  { allergenKey: "pistachio", displayName: "Pistachio", severity: "avoid" },
];

export type IngredientAvailability = {
  name: string;
  quantity: number | null;
  unit: InventoryUnit | null;
  ingredientKey: string;
  optional: boolean;
  status: "in_stock" | "partial" | "missing" | "included_in_packet";
  availableQuantity: number | null;
  availableUnit: InventoryUnit | null;
};

export type MealRecommendation = {
  recipeId: string;
  recipeTitle: string;
  recipeType: RecipeType;
  packagedMealDefId: string | null;
  catalogProductId: string | null;
  productLabel: string | null;
  packetsInStock: number;
  packetsRequired: number;
  missingCount: number;
  inStockCount: number;
  includedCount: number;
  ingredients: IngredientAvailability[];
  allergenStatus: AllergenStatus;
  allergens: string[];
  instructionsVerified: boolean;
  score: number;
  reason: string;
};

export type CatalogUpsertInput = {
  householdId: string;
  brand?: string | null;
  displayName: string;
  variant?: string | null;
  packSize?: string | null;
  originalName?: string | null;
  sourceType?: string | null;
  notes?: string | null;
  /** Force kind when user confirms; otherwise heuristics apply. */
  productKind?: ProductKind;
  kindConfirmed?: boolean;
};

export type PackagedMealWriteInput = {
  householdId: string;
  catalogProductId: string;
  title: string;
  variationOfRecipeId?: string | null;
  servingsPerPacket: number;
  packetsRequired: number;
  instructions: string;
  instructionsSource: "user_packet_photo" | "user_typed" | "trusted" | "manual";
  sourceReference?: string | null;
  notes?: string | null;
  included: Array<{
    name: string;
    quantity: number | null;
    unit: InventoryUnit | null;
    notes?: string | null;
  }>;
  additionalIngredients: Array<{
    name: string;
    quantity: number | null;
    unit: InventoryUnit | null;
    optional?: boolean;
    notes?: string | null;
  }>;
  allergens?: string[];
  allergenStatus?: AllergenStatus;
  allergenNotes?: string | null;
};

export type CookDeductionLine = {
  inventoryItemId: string;
  name: string;
  amount: number;
  unit: InventoryUnit;
  role: "packet" | "additional";
};

export type CookConfirmInput = {
  householdId: string;
  recipeId: string;
  packagedMealDefId?: string | null;
  mealPlanEntryId?: string | null;
  packetsUsed: number;
  servings?: number | null;
  deductions: CookDeductionLine[];
};
