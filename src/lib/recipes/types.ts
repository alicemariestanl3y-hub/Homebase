import type { InventoryUnit } from "@/lib/inventory/types";

export type RecipeIngredientInput = {
  name: string;
  quantity: number | null;
  unit: InventoryUnit | null;
  notes?: string | null;
  optional?: boolean;
};

export type RecipeIngredient = RecipeIngredientInput & {
  id: string;
  ingredientKey: string;
  sortOrder: number;
};

export type Recipe = {
  id: string;
  householdId: string;
  title: string;
  sourceUrl: string | null;
  sourceName: string | null;
  attribution: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  cuisine: string | null;
  cookingMethod: string | null;
  instructions: string | null;
  notes: string | null;
  isFavourite: boolean;
  freezerSuitable: boolean;
  leftoverFriendly: boolean;
  dietaryTags: string[];
  variationOfRecipeId: string | null;
  /** traditional | recipe_base | meal_kit — packet meals link a catalog product. */
  recipeType: "traditional" | "recipe_base" | "meal_kit";
  catalogProductId: string | null;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
};

export type RecipeListItem = Omit<Recipe, "ingredients" | "instructions"> & {
  ingredientCount: number;
};

export type RecipeWriteInput = {
  title: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  attribution?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  cuisine?: string | null;
  cookingMethod?: string | null;
  instructions?: string | null;
  notes?: string | null;
  isFavourite?: boolean;
  freezerSuitable?: boolean;
  leftoverFriendly?: boolean;
  dietaryTags?: string[];
  variationOfRecipeId?: string | null;
  recipeType?: "traditional" | "recipe_base" | "meal_kit";
  catalogProductId?: string | null;
  ingredients: RecipeIngredientInput[];
};

export const CUISINE_OPTIONS = [
  "Australian",
  "Italian",
  "Asian",
  "Indian",
  "Mexican",
  "Middle Eastern",
  "American",
  "Other",
] as const;

export const METHOD_OPTIONS = [
  "Stovetop",
  "Oven",
  "Slow cooker",
  "Thermomix / skinnymixer",
  "Air fryer",
  "No-cook",
  "Packet meal",
  "Other",
] as const;

export const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten free",
  "Dairy free",
  "Nut free",
  "Halal",
] as const;
