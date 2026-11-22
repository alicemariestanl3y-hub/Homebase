import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import {
  linkInventoryItemToCatalog,
  listPackagedMealDefs,
  upsertCatalogProduct,
} from "@/lib/packaged-meals/repository";
import type { ProductKind } from "@/lib/packaged-meals/types";

/**
 * Manually link an inventory item to a catalog product.
 * Used when automatic recognition fails. Does not invent a recipe —
 * user confirms packet instructions on the verify screen next.
 */
export async function POST(request: Request) {
  try {
    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      inventoryItemId?: string;
      displayName?: string;
      brand?: string | null;
      packSize?: string | null;
      productKind?: ProductKind;
      createRecipeTitle?: string | null;
    };

    if (!body.inventoryItemId || !body.displayName?.trim()) {
      return NextResponse.json(
        { error: "Inventory item and product name are required." },
        { status: 400 },
      );
    }

    const kind = body.productKind ?? "recipe_base";
    if (
      !["recipe_base", "meal_kit", "cooking_sauce"].includes(kind)
    ) {
      return NextResponse.json(
        { error: "Choose recipe base, meal kit, or cooking sauce." },
        { status: 400 },
      );
    }

    const product = await upsertCatalogProduct({
      householdId: household.householdId,
      displayName: body.displayName.trim(),
      brand: body.brand ?? null,
      packSize: body.packSize ?? null,
      originalName: body.displayName.trim(),
      productKind: kind,
      kindConfirmed: true,
      sourceType: "manual",
    });

    await linkInventoryItemToCatalog(
      household.householdId,
      body.inventoryItemId,
      product.id,
    );

    const defs = await listPackagedMealDefs(household.householdId);
    const existingDef = defs.find((row) => row.catalogProductId === product.id);

    return NextResponse.json({
      product,
      recipeId: existingDef?.recipeId ?? null,
      packagedMealDefId: existingDef?.id ?? null,
      needsPacketVerify: !existingDef,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not link inventory item.",
      },
      { status: 500 },
    );
  }
}
