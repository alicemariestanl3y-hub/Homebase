import {
  compareQuantities,
  toIngredientKey,
} from "@/lib/ingredients/matching";
import type { InventoryItem, InventoryUnit } from "@/lib/inventory/types";
import type { Recipe } from "@/lib/recipes/types";
import type {
  AllergenStatus,
  CatalogProduct,
  IngredientAvailability,
  MealRecommendation,
  PackagedMealDef,
  RecipeType,
} from "./types";

type StockIndex = Map<
  string,
  Array<{ item: InventoryItem; key: string }>
>;

function buildStockIndex(items: InventoryItem[]): StockIndex {
  const index: StockIndex = new Map();
  for (const item of items) {
    const key = toIngredientKey(item.name);
    const list = index.get(key) ?? [];
    list.push({ item, key });
    index.set(key, list);
  }
  return index;
}

function availabilityFor(
  name: string,
  quantity: number | null,
  unit: InventoryUnit | null,
  optional: boolean,
  stock: StockIndex,
  includedKeys: Set<string>,
): IngredientAvailability {
  const ingredientKey = toIngredientKey(name);
  if (includedKeys.has(ingredientKey)) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: "included_in_packet",
      availableQuantity: null,
      availableUnit: null,
    };
  }

  const matches = stock.get(ingredientKey) ?? [];
  // Also try loose token overlap via scanning when exact key misses.
  const loose =
    matches.length > 0
      ? matches
      : [...stock.values()]
          .flat()
          .filter((row) => {
            const a = new Set(ingredientKey.split("_"));
            const b = new Set(row.key.split("_"));
            let hit = 0;
            for (const token of a) if (b.has(token)) hit += 1;
            return hit >= Math.min(2, a.size);
          });

  if (loose.length === 0) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: optional ? "in_stock" : "missing",
      availableQuantity: null,
      availableUnit: null,
    };
  }

  const total = loose.reduce((sum, row) => sum + row.item.quantity, 0);
  const availableUnit = loose[0]!.item.unit;
  if (quantity == null || unit == null) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: "in_stock",
      availableQuantity: total,
      availableUnit,
    };
  }

  const compared = compareQuantities(total, availableUnit, unit);
  if (!compared.comparable || compared.convertedQuantity == null) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: total > 0 ? "partial" : "missing",
      availableQuantity: total,
      availableUnit,
    };
  }

  if (compared.convertedQuantity >= quantity) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: "in_stock",
      availableQuantity: compared.convertedQuantity,
      availableUnit: unit,
    };
  }
  if (compared.convertedQuantity > 0) {
    return {
      name,
      quantity,
      unit,
      ingredientKey,
      optional,
      status: "partial",
      availableQuantity: compared.convertedQuantity,
      availableUnit: unit,
    };
  }
  return {
    name,
    quantity,
    unit,
    ingredientKey,
    optional,
    status: "missing",
    availableQuantity: 0,
    availableUnit: unit,
  };
}

function packetsInStockForProduct(
  productId: string,
  inventory: InventoryItem[],
  productById: Map<string, CatalogProduct>,
): number {
  const product = productById.get(productId);
  if (!product) return 0;
  const key = product.ingredientKey;
  return inventory
    .filter((item) => {
      if (item.catalogProductId === productId) return true;
      return toIngredientKey(item.name) === key;
    })
    .reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Prefer verified packaged meals whose base/kit is already in inventory,
 * then traditional recipes by fewest missing ingredients.
 */
export function buildMealRecommendations(input: {
  recipes: Recipe[];
  products: CatalogProduct[];
  defs: PackagedMealDef[];
  inventory: InventoryItem[];
}): MealRecommendation[] {
  const stock = buildStockIndex(input.inventory);
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const recipeById = new Map(input.recipes.map((r) => [r.id, r]));
  const recommendations: MealRecommendation[] = [];

  for (const def of input.defs) {
    const recipe = recipeById.get(def.recipeId);
    const product = productById.get(def.catalogProductId);
    if (!recipe || !product) continue;
    if (
      product.productKind !== "recipe_base" &&
      product.productKind !== "meal_kit"
    ) {
      continue;
    }

    const includedKeys = new Set(
      def.included.map((row) => row.ingredientKey || toIngredientKey(row.name)),
    );
    const ingredients = recipe.ingredients.map((ing) =>
      availabilityFor(
        ing.name,
        ing.quantity,
        ing.unit,
        Boolean(ing.optional),
        stock,
        includedKeys,
      ),
    );

    const packetsInStock = packetsInStockForProduct(
      product.id,
      input.inventory,
      productById,
    );
    const missingCount = ingredients.filter(
      (row) => row.status === "missing" && !row.optional,
    ).length;
    const inStockCount = ingredients.filter(
      (row) => row.status === "in_stock" || row.status === "partial",
    ).length;
    const includedCount = ingredients.filter(
      (row) => row.status === "included_in_packet",
    ).length;

    const hasPacket = packetsInStock >= def.packetsRequired;
    if (!hasPacket && packetsInStock <= 0) continue;

    const score =
      (def.instructionsVerified ? 40 : 10) +
      (hasPacket ? 30 : 5) +
      Math.max(0, 20 - missingCount * 5) +
      (product.allergenStatus === "unverified" ? -15 : 0) +
      (product.allergenStatus === "contains_restricted" ? -40 : 0);

    recommendations.push({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeType: (recipe.recipeType ?? "recipe_base") as RecipeType,
      packagedMealDefId: def.id,
      catalogProductId: product.id,
      productLabel: [product.brand, product.displayName, product.variant]
        .filter(Boolean)
        .join(" "),
      packetsInStock,
      packetsRequired: def.packetsRequired,
      missingCount,
      inStockCount,
      includedCount,
      ingredients,
      allergenStatus: product.allergenStatus,
      allergens: product.allergens,
      instructionsVerified: def.instructionsVerified,
      score,
      reason: hasPacket
        ? missingCount === 0
          ? "Packet in stock and additional ingredients covered."
          : `Packet in stock · ${missingCount} ingredient${missingCount === 1 ? "" : "s"} to buy.`
        : "Low packet stock — top up before cooking.",
    });
  }

  // Traditional recipes as alternatives (lower priority).
  for (const recipe of input.recipes) {
    if ((recipe.recipeType ?? "traditional") !== "traditional") continue;
    if (recommendations.some((row) => row.recipeId === recipe.id)) continue;

    const ingredients = recipe.ingredients.map((ing) =>
      availabilityFor(
        ing.name,
        ing.quantity,
        ing.unit,
        Boolean(ing.optional),
        stock,
        new Set(),
      ),
    );
    const missingCount = ingredients.filter(
      (row) => row.status === "missing" && !row.optional,
    ).length;
    if (missingCount > 4) continue;

    recommendations.push({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeType: "traditional",
      packagedMealDefId: null,
      catalogProductId: null,
      productLabel: null,
      packetsInStock: 0,
      packetsRequired: 0,
      missingCount,
      inStockCount: ingredients.filter((row) => row.status === "in_stock")
        .length,
      includedCount: 0,
      ingredients,
      allergenStatus: "unverified" as AllergenStatus,
      allergens: [],
      instructionsVerified: Boolean(recipe.instructions),
      score: Math.max(0, 15 - missingCount * 3),
      reason:
        missingCount === 0
          ? "Traditional recipe — ingredients look available."
          : `Traditional alternative · ${missingCount} to buy.`,
    });
  }

  return recommendations.sort((a, b) => b.score - a.score || a.missingCount - b.missingCount);
}
