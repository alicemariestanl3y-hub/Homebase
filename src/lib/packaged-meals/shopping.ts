import type { InventoryUnit } from "@/lib/inventory/types";
import type { IngredientAvailability, MealRecommendation } from "./types";

export type ShoppingLine = {
  name: string;
  quantity: number | null;
  unit: InventoryUnit | null;
  ingredientKey: string;
  notes: string;
  fromRecipeId: string;
};

/**
 * Build shopping lines for a recommended meal.
 * Skips packet-included ingredients and items already in stock.
 * Adds the packaged product itself when packet stock is insufficient.
 */
export function shoppingLinesForRecommendation(
  recommendation: MealRecommendation,
): ShoppingLine[] {
  const lines: ShoppingLine[] = [];

  if (
    recommendation.catalogProductId &&
    recommendation.productLabel &&
    recommendation.packetsInStock < recommendation.packetsRequired
  ) {
    const need =
      recommendation.packetsRequired - recommendation.packetsInStock;
    lines.push({
      name: recommendation.productLabel,
      quantity: need,
      unit: "packets",
      ingredientKey: recommendation.catalogProductId,
      notes: "Packaged recipe base / meal kit",
      fromRecipeId: recommendation.recipeId,
    });
  }

  for (const ingredient of recommendation.ingredients) {
    if (ingredient.status === "included_in_packet") continue;
    if (ingredient.optional && ingredient.status !== "missing") continue;
    if (ingredient.status === "in_stock") continue;

    lines.push({
      name: ingredient.name,
      quantity: missingQuantity(ingredient),
      unit: ingredient.unit,
      ingredientKey: ingredient.ingredientKey,
      notes:
        ingredient.status === "partial"
          ? "Top up — partial stock at home"
          : "Needed for packet meal",
      fromRecipeId: recommendation.recipeId,
    });
  }

  return lines;
}

function missingQuantity(
  ingredient: IngredientAvailability,
): number | null {
  if (ingredient.quantity == null) return null;
  if (
    ingredient.status === "partial" &&
    ingredient.availableQuantity != null
  ) {
    return Math.max(0, ingredient.quantity - ingredient.availableQuantity);
  }
  return ingredient.quantity;
}
