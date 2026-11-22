import { toIngredientKey } from "@/lib/ingredients/matching";
import { toDbError } from "@/lib/inventory/db-error";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRecipe } from "@/lib/recipes/repository";
import {
  catalogIngredientKey,
  productIdentityKey,
  splitBrandAndName,
} from "./identity";
import { detectAllergenMentions, recognizePackagedMealProduct } from "./recognize";
import type {
  CatalogProduct,
  CatalogUpsertInput,
  CookConfirmInput,
  PackagedMealDef,
  PackagedMealWriteInput,
  ProductKind,
} from "./types";

type DbCatalog = {
  id: string;
  household_id: string;
  brand: string | null;
  display_name: string;
  variant: string | null;
  pack_size: string | null;
  original_name: string | null;
  product_kind: ProductKind;
  kind_suggested: ProductKind | null;
  kind_confirmed: boolean;
  ingredient_key: string | null;
  identity_key: string;
  allergen_status: CatalogProduct["allergenStatus"];
  allergens: string[] | null;
  allergen_notes: string | null;
  allergen_verified_at: string | null;
  allergen_source: string | null;
  source_type: string | null;
  source_url: string | null;
  source_captured_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const demoProducts = new Map<string, CatalogProduct>();
const demoDefs = new Map<string, PackagedMealDef>();
const demoCookIds = new Set<string>();

function mapCatalog(row: DbCatalog): CatalogProduct {
  return {
    id: row.id,
    householdId: row.household_id,
    brand: row.brand,
    displayName: row.display_name,
    variant: row.variant,
    packSize: row.pack_size,
    originalName: row.original_name,
    productKind: row.product_kind,
    kindSuggested: row.kind_suggested,
    kindConfirmed: row.kind_confirmed,
    ingredientKey: row.ingredient_key || toIngredientKey(row.display_name),
    identityKey: row.identity_key,
    allergenStatus: row.allergen_status,
    allergens: row.allergens ?? [],
    allergenNotes: row.allergen_notes,
    allergenVerifiedAt: row.allergen_verified_at,
    allergenSource: row.allergen_source,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceCapturedAt: row.source_captured_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCatalogProducts(
  householdId: string,
  kinds?: ProductKind[],
): Promise<CatalogProduct[]> {
  if (!isSupabaseConfigured()) {
    return [...demoProducts.values()]
      .filter((row) => row.householdId === householdId)
      .filter((row) => !kinds || kinds.includes(row.productKind))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const supabase = await createClient();
  let query = supabase
    .from("catalog_products")
    .select("*")
    .eq("household_id", householdId)
    .order("display_name");
  if (kinds?.length) query = query.in("product_kind", kinds);
  const { data, error } = await query;
  if (error) throw toDbError(error, "Could not load catalog products.");
  return ((data ?? []) as DbCatalog[]).map(mapCatalog);
}

export async function upsertCatalogProduct(
  input: CatalogUpsertInput,
): Promise<CatalogProduct> {
  const parsed = splitBrandAndName(input.displayName);
  const brand = input.brand?.trim() || parsed.brand;
  const displayName = parsed.displayName || input.displayName.trim();
  const variant = input.variant?.trim() || parsed.variant;
  const packSize = input.packSize?.trim() || parsed.packSize;
  const originalName = input.originalName?.trim() || input.displayName.trim();
  const identityKey = productIdentityKey({
    brand,
    displayName,
    variant,
    packSize,
    originalName,
  });
  const ingredientKey = catalogIngredientKey({ brand, displayName, variant });
  const recognition = recognizePackagedMealProduct({
    name: originalName,
    brand,
    notes: input.notes ?? null,
  });
  const productKind =
    input.productKind ??
    (recognition.suggestedKind === "unclassified"
      ? "unclassified"
      : recognition.suggestedKind);
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const existing = [...demoProducts.values()].find(
      (row) =>
        row.householdId === input.householdId && row.identityKey === identityKey,
    );
    if (existing) {
      const updated: CatalogProduct = {
        ...existing,
        brand,
        displayName,
        variant,
        packSize,
        originalName,
        productKind: input.kindConfirmed
          ? productKind
          : existing.kindConfirmed
            ? existing.productKind
            : productKind,
        kindSuggested: recognition.suggestedKind,
        kindConfirmed: input.kindConfirmed ?? existing.kindConfirmed,
        ingredientKey,
        sourceType: input.sourceType ?? existing.sourceType,
        notes: input.notes ?? existing.notes,
        updatedAt: now,
      };
      demoProducts.set(existing.id, updated);
      return updated;
    }

    const created: CatalogProduct = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      brand,
      displayName,
      variant,
      packSize,
      originalName,
      productKind,
      kindSuggested: recognition.suggestedKind,
      kindConfirmed: Boolean(input.kindConfirmed),
      ingredientKey,
      identityKey,
      allergenStatus: "unverified",
      allergens: [],
      allergenNotes: null,
      allergenVerifiedAt: null,
      allergenSource: null,
      sourceType: input.sourceType ?? null,
      sourceUrl: null,
      sourceCapturedAt: now,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    demoProducts.set(created.id, created);
    return created;
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("catalog_products")
    .select("*")
    .eq("household_id", input.householdId)
    .eq("identity_key", identityKey)
    .maybeSingle();

  if (existing) {
    const row = existing as DbCatalog;
    const nextKind = input.kindConfirmed
      ? productKind
      : row.kind_confirmed
        ? row.product_kind
        : productKind;
    const { data, error } = await supabase
      .from("catalog_products")
      .update({
        brand,
        display_name: displayName,
        variant,
        pack_size: packSize,
        original_name: originalName,
        product_kind: nextKind,
        kind_suggested: recognition.suggestedKind,
        kind_confirmed: input.kindConfirmed ?? row.kind_confirmed,
        ingredient_key: ingredientKey,
        source_type: input.sourceType ?? row.source_type,
        notes: input.notes ?? row.notes,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw toDbError(error, "Could not update catalog product.");
    return mapCatalog(data as DbCatalog);
  }

  const { data, error } = await supabase
    .from("catalog_products")
    .insert({
      household_id: input.householdId,
      brand,
      display_name: displayName,
      variant,
      pack_size: packSize,
      original_name: originalName,
      product_kind: productKind,
      kind_suggested: recognition.suggestedKind,
      kind_confirmed: Boolean(input.kindConfirmed),
      ingredient_key: ingredientKey,
      identity_key: identityKey,
      allergen_status: "unverified",
      source_type: input.sourceType ?? null,
      source_captured_at: now,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw toDbError(error, "Could not create catalog product.");
  return mapCatalog(data as DbCatalog);
}

export async function updateCatalogProductKind(
  householdId: string,
  productId: string,
  productKind: ProductKind,
): Promise<CatalogProduct> {
  if (!isSupabaseConfigured()) {
    const existing = demoProducts.get(productId);
    if (!existing || existing.householdId !== householdId) {
      throw new Error("Product not found.");
    }
    const updated = {
      ...existing,
      productKind,
      kindConfirmed: true,
      updatedAt: new Date().toISOString(),
    };
    demoProducts.set(productId, updated);
    return updated;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_products")
    .update({
      product_kind: productKind,
      kind_confirmed: true,
    })
    .eq("id", productId)
    .eq("household_id", householdId)
    .select("*")
    .single();
  if (error) throw toDbError(error, "Could not update product classification.");
  return mapCatalog(data as DbCatalog);
}

export async function linkInventoryItemToCatalog(
  householdId: string,
  itemId: string,
  catalogProductId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { getInventoryRepository } = await import(
      "@/lib/inventory/get-repository"
    );
    const repo = getInventoryRepository();
    const snapshot = await repo.getSnapshot(householdId);
    const existing = snapshot?.items.find((row) => row.id === itemId);
    if (!existing) throw new Error("Inventory item not found.");
    const location = snapshot?.locations.find(
      (row) => row.id === existing.locationId,
    );
    await repo.updateItem({
      householdId,
      itemId,
      name: existing.name,
      quantity: existing.quantity,
      unit: existing.unit,
      locationType: location?.type ?? "pantry",
      expiresOn: existing.expiresOn,
      notes: existing.notes,
      catalogProductId,
    });
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ catalog_product_id: catalogProductId })
    .eq("id", itemId)
    .eq("household_id", householdId);
  if (error) throw toDbError(error, "Could not link inventory item to product.");
}

export async function listPackagedMealDefs(
  householdId: string,
): Promise<PackagedMealDef[]> {
  if (!isSupabaseConfigured()) {
    return [...demoDefs.values()].filter(
      (row) => row.householdId === householdId,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packaged_meal_defs")
    .select(
      "*, packaged_meal_included(id, name, quantity, unit, ingredient_key, notes, sort_order)",
    )
    .eq("household_id", householdId);
  if (error) throw toDbError(error, "Could not load packaged meals.");

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const included = (
      (row.packaged_meal_included as Array<Record<string, unknown>>) ?? []
    )
      .map((ing) => ({
        id: String(ing.id),
        name: String(ing.name),
        quantity: ing.quantity == null ? null : Number(ing.quantity),
        unit: (ing.unit as PackagedMealDef["included"][number]["unit"]) ?? null,
        ingredientKey:
          String(ing.ingredient_key || toIngredientKey(String(ing.name))),
        notes: (ing.notes as string | null) ?? null,
        sortOrder: Number(ing.sort_order ?? 0),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      id: String(row.id),
      householdId: String(row.household_id),
      catalogProductId: String(row.catalog_product_id),
      recipeId: String(row.recipe_id),
      servingsPerPacket: Number(row.servings_per_packet),
      packetsRequired: Number(row.packets_required),
      instructions: (row.instructions as string | null) ?? null,
      instructionsVerified: Boolean(row.instructions_verified),
      instructionsSource: (row.instructions_source as string | null) ?? null,
      instructionsCapturedAt:
        (row.instructions_captured_at as string | null) ?? null,
      sourceReference: (row.source_reference as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      included,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });
}

/**
 * Creates a verified packaged-meal definition + linked recipe.
 * Instructions must be provided by the user — never invented.
 */
export async function createVerifiedPackagedMeal(
  input: PackagedMealWriteInput,
): Promise<{ def: PackagedMealDef; product: CatalogProduct }> {
  const instructions = input.instructions.trim();
  if (!instructions) {
    throw new Error(
      "Paste or type the packet cooking instructions. HomeBase will not invent them.",
    );
  }
  if (!input.additionalIngredients.length && !input.included.length) {
    throw new Error(
      "Add ingredients included in the packet and/or additional ingredients needed.",
    );
  }

  const products = await listCatalogProducts(input.householdId);
  const product = products.find((row) => row.id === input.catalogProductId);
  if (!product) throw new Error("Catalog product not found.");

  const recipeType =
    product.productKind === "meal_kit" ? "meal_kit" : "recipe_base";
  // Keep cooking_sauce distinct on the catalog product; meals library uses recipe_base.
  const confirmedCatalogKind =
    product.productKind === "cooking_sauce" ||
    product.productKind === "meal_kit" ||
    product.productKind === "recipe_base"
      ? product.productKind
      : recipeType;

  const recipe = await createRecipe(input.householdId, {
    title: input.title.trim(),
    servings: input.servingsPerPacket,
    cookingMethod: "Packet meal",
    instructions,
    notes: input.notes ?? null,
    sourceName: product.brand
      ? `${product.brand} packet`
      : "Packet instructions",
    variationOfRecipeId: input.variationOfRecipeId ?? null,
    recipeType,
    catalogProductId: product.id,
    ingredients: input.additionalIngredients.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      optional: row.optional,
      notes: row.notes ?? null,
    })),
  });

  const mentioned = detectAllergenMentions(
    `${instructions} ${input.allergenNotes ?? ""} ${input.allergens?.join(" ") ?? ""}`,
  );
  const allergens = [...new Set([...(input.allergens ?? []), ...mentioned])];
  const allergenStatus = input.allergenStatus ?? "unverified";
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const updatedProduct: CatalogProduct = {
      ...product,
      productKind: confirmedCatalogKind,
      kindConfirmed: true,
      allergenStatus,
      allergens,
      allergenNotes: input.allergenNotes ?? product.allergenNotes,
      allergenVerifiedAt:
        allergenStatus === "unverified" ? null : now,
      allergenSource: input.instructionsSource,
      updatedAt: now,
    };
    demoProducts.set(product.id, updatedProduct);

    const def: PackagedMealDef = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      catalogProductId: product.id,
      recipeId: recipe.id,
      servingsPerPacket: input.servingsPerPacket,
      packetsRequired: input.packetsRequired,
      instructions,
      instructionsVerified: true,
      instructionsSource: input.instructionsSource,
      instructionsCapturedAt: now,
      sourceReference: input.sourceReference ?? null,
      notes: input.notes ?? null,
      included: input.included.map((row, index) => ({
        id: crypto.randomUUID(),
        name: row.name.trim(),
        quantity: row.quantity,
        unit: row.unit,
        ingredientKey: toIngredientKey(row.name),
        notes: row.notes ?? null,
        sortOrder: index,
      })),
      createdAt: now,
      updatedAt: now,
    };
    demoDefs.set(def.id, def);
    return { def, product: updatedProduct };
  }

  const supabase = await createClient();
  await supabase
    .from("catalog_products")
    .update({
      product_kind: confirmedCatalogKind,
      kind_confirmed: true,
      allergen_status: allergenStatus,
      allergens,
      allergen_notes: input.allergenNotes ?? null,
      allergen_verified_at: allergenStatus === "unverified" ? null : now,
      allergen_source: input.instructionsSource,
    })
    .eq("id", product.id)
    .eq("household_id", input.householdId);

  const { data: defRow, error } = await supabase
    .from("packaged_meal_defs")
    .insert({
      household_id: input.householdId,
      catalog_product_id: product.id,
      recipe_id: recipe.id,
      servings_per_packet: input.servingsPerPacket,
      packets_required: input.packetsRequired,
      instructions,
      instructions_verified: true,
      instructions_source: input.instructionsSource,
      instructions_captured_at: now,
      source_reference: input.sourceReference ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw toDbError(error, "Could not save packaged meal definition.");

  if (input.included.length) {
    const { error: includedError } = await supabase
      .from("packaged_meal_included")
      .insert(
        input.included.map((row, index) => ({
          packaged_meal_def_id: defRow.id,
          household_id: input.householdId,
          name: row.name.trim(),
          quantity: row.quantity,
          unit: row.unit,
          ingredient_key: toIngredientKey(row.name),
          notes: row.notes ?? null,
          sort_order: index,
        })),
      );
    if (includedError) {
      throw toDbError(includedError, "Could not save included ingredients.");
    }
  }

  const defs = await listPackagedMealDefs(input.householdId);
  const def = defs.find((row) => row.id === defRow.id);
  if (!def) throw new Error("Saved packaged meal but could not reload it.");
  const refreshed = (await listCatalogProducts(input.householdId)).find(
    (row) => row.id === product.id,
  );
  return { def, product: refreshed ?? product };
}

export async function confirmCookMeal(
  input: CookConfirmInput,
): Promise<{ cookEventId: string }> {
  if (!input.deductions.length) {
    throw new Error("Review and confirm at least one deduction before cooking.");
  }

  const fingerprint = [
    input.householdId,
    input.recipeId,
    input.mealPlanEntryId ?? "",
    input.packagedMealDefId ?? "",
    input.packetsUsed,
    ...input.deductions.map(
      (row) => `${row.inventoryItemId}:${row.amount}:${row.unit}`,
    ),
  ].join("|");

  if (!isSupabaseConfigured()) {
    if (demoCookIds.has(fingerprint)) {
      throw new Error("This cook was already confirmed — avoiding duplicate deductions.");
    }
    demoCookIds.add(fingerprint);
    // Demo mode: deductions applied by caller via inventory APIs.
    return { cookEventId: crypto.randomUUID() };
  }

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("meal_cook_events")
    .select("id, confirmation_payload, created_at")
    .eq("household_id", input.householdId)
    .eq("recipe_id", input.recipeId)
    .eq("deducted", true)
    .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(5);

  const duplicate = (recent ?? []).some((row) => {
    const payload = row.confirmation_payload as { fingerprint?: string } | null;
    return payload?.fingerprint === fingerprint;
  });
  if (duplicate) {
    throw new Error("This cook was already confirmed — avoiding duplicate deductions.");
  }

  const { data, error } = await supabase
    .from("meal_cook_events")
    .insert({
      household_id: input.householdId,
      recipe_id: input.recipeId,
      meal_plan_entry_id: input.mealPlanEntryId ?? null,
      packaged_meal_def_id: input.packagedMealDefId ?? null,
      packets_used: input.packetsUsed,
      servings: input.servings ?? null,
      deducted: true,
      confirmation_payload: { fingerprint, deductions: input.deductions },
    })
    .select("id")
    .single();
  if (error) throw toDbError(error, "Could not record cook confirmation.");
  return { cookEventId: data.id as string };
}
