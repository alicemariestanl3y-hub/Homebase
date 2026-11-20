import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import {
  getDemoHouseholdId,
  getInventoryMode,
  getInventoryRepository,
} from "@/lib/inventory/get-repository";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import { buildMealRecommendations } from "@/lib/packaged-meals/recommend";
import {
  listCatalogProducts,
  listPackagedMealDefs,
} from "@/lib/packaged-meals/repository";
import { listRecipes, getRecipe } from "@/lib/recipes/repository";

export async function GET() {
  try {
    const household = await resolveHouseholdIdForRequest();
    const householdId =
      household.householdId ??
      (getInventoryMode() === "demo" ? getDemoHouseholdId() : null);
    if (!householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }

    const [list, products, defs] = await Promise.all([
      listRecipes(householdId),
      listCatalogProducts(householdId),
      listPackagedMealDefs(householdId),
    ]);

    const recipes = (
      await Promise.all(list.map((row) => getRecipe(householdId, row.id)))
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));

    const repo = getInventoryRepository();
    const inventory = (
      await Promise.all(
        LOCATION_ORDER.map((location) =>
          repo.listItemsByLocation(householdId, location),
        ),
      )
    ).flat();

    const recommendations = buildMealRecommendations({
      recipes,
      products,
      defs,
      inventory,
    });

    const pendingBases = products.filter(
      (product) =>
        (product.productKind === "recipe_base" ||
          product.productKind === "meal_kit" ||
          product.kindSuggested === "recipe_base" ||
          product.kindSuggested === "meal_kit") &&
        !defs.some((def) => def.catalogProductId === product.id),
    );

    return NextResponse.json({
      recommendations,
      pendingBases,
      products,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not build recommendations.",
      },
      { status: 500 },
    );
  }
}
