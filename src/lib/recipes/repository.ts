import { toDbError } from "@/lib/inventory/db-error";
import { toIngredientKey } from "@/lib/ingredients/matching";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  Recipe,
  RecipeIngredient,
  RecipeListItem,
  RecipeWriteInput,
} from "./types";

type DbRecipe = {
  id: string;
  household_id: string;
  title: string;
  source_url: string | null;
  source_name: string | null;
  attribution: string | null;
  servings: number | string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  cuisine: string | null;
  cooking_method: string | null;
  instructions: string | null;
  notes: string | null;
  is_favourite: boolean;
  freezer_suitable: boolean;
  leftover_friendly: boolean;
  dietary_tags: string[] | null;
  variation_of_recipe_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbIngredient = {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  ingredient_key: string | null;
  notes: string | null;
  optional: boolean;
  sort_order: number;
};

function mapIngredient(row: DbIngredient): RecipeIngredient {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: (row.unit as RecipeIngredient["unit"]) ?? null,
    notes: row.notes,
    optional: row.optional,
    ingredientKey: row.ingredient_key || toIngredientKey(row.name),
    sortOrder: row.sort_order,
  };
}

function mapRecipe(row: DbRecipe, ingredients: RecipeIngredient[]): Recipe {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    attribution: row.attribution,
    servings: Number(row.servings),
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    cuisine: row.cuisine,
    cookingMethod: row.cooking_method,
    instructions: row.instructions,
    notes: row.notes,
    isFavourite: row.is_favourite,
    freezerSuitable: row.freezer_suitable,
    leftoverFriendly: row.leftover_friendly,
    dietaryTags: row.dietary_tags ?? [],
    variationOfRecipeId: row.variation_of_recipe_id,
    ingredients,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** In-memory demo recipes when Supabase secrets are absent. */
const demoRecipes = new Map<string, Recipe>();

function demoList(householdId: string): RecipeListItem[] {
  return [...demoRecipes.values()]
    .filter((recipe) => recipe.householdId === householdId)
    .map((recipe) => ({
      ...recipe,
      ingredientCount: recipe.ingredients.length,
    }));
}

export async function listRecipes(
  householdId: string,
): Promise<RecipeListItem[]> {
  if (!isSupabaseConfigured()) {
    return demoList(householdId).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, household_id, title, source_url, source_name, attribution, servings, prep_minutes, cook_minutes, cuisine, cooking_method, notes, is_favourite, freezer_suitable, leftover_friendly, dietary_tags, variation_of_recipe_id, created_at, updated_at, recipe_ingredients(count)",
    )
    .eq("household_id", householdId)
    .order("title");

  if (error) throw toDbError(error, "Could not load recipes.");

  return ((data ?? []) as Array<DbRecipe & { recipe_ingredients: { count: number }[] | number }>).map(
    (row) => {
      const countField = row.recipe_ingredients;
      const ingredientCount = Array.isArray(countField)
        ? Number(countField[0]?.count ?? 0)
        : Number(countField ?? 0);
      const recipe = mapRecipe(row, []);
      return { ...recipe, ingredientCount };
    },
  );
}

export async function getRecipe(
  householdId: string,
  recipeId: string,
): Promise<Recipe | null> {
  if (!isSupabaseConfigured()) {
    const recipe = demoRecipes.get(recipeId);
    return recipe?.householdId === householdId ? recipe : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, household_id, title, source_url, source_name, attribution, servings, prep_minutes, cook_minutes, cuisine, cooking_method, instructions, notes, is_favourite, freezer_suitable, leftover_friendly, dietary_tags, variation_of_recipe_id, created_at, updated_at",
    )
    .eq("household_id", householdId)
    .eq("id", recipeId)
    .maybeSingle();

  if (error) throw toDbError(error, "Could not load recipe.");
  if (!data) return null;

  const { data: ingredients, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .select(
      "id, name, quantity, unit, ingredient_key, notes, optional, sort_order",
    )
    .eq("recipe_id", recipeId)
    .eq("household_id", householdId)
    .order("sort_order");

  if (ingredientError) {
    throw toDbError(ingredientError, "Could not load recipe ingredients.");
  }

  return mapRecipe(
    data as DbRecipe,
    ((ingredients ?? []) as DbIngredient[]).map(mapIngredient),
  );
}

export async function createRecipe(
  householdId: string,
  input: RecipeWriteInput,
  userId?: string | null,
): Promise<Recipe> {
  const title = input.title.trim();
  if (!title) throw new Error("Recipe title is required.");
  if (!input.ingredients?.length) {
    throw new Error("Add at least one ingredient (don’t leave the list empty).");
  }
  if (!(input.servings > 0)) throw new Error("Servings must be greater than 0.");

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const recipe: Recipe = {
      id,
      householdId,
      title,
      sourceUrl: input.sourceUrl?.trim() || null,
      sourceName: input.sourceName?.trim() || null,
      attribution: input.attribution?.trim() || null,
      servings: input.servings,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      cuisine: input.cuisine?.trim() || null,
      cookingMethod: input.cookingMethod?.trim() || null,
      instructions: input.instructions?.trim() || null,
      notes: input.notes?.trim() || null,
      isFavourite: Boolean(input.isFavourite),
      freezerSuitable: Boolean(input.freezerSuitable),
      leftoverFriendly: Boolean(input.leftoverFriendly),
      dietaryTags: input.dietaryTags ?? [],
      variationOfRecipeId: input.variationOfRecipeId ?? null,
      ingredients: input.ingredients.map((ingredient, index) => ({
        id: crypto.randomUUID(),
        name: ingredient.name.trim(),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes ?? null,
        optional: Boolean(ingredient.optional),
        ingredientKey: toIngredientKey(ingredient.name),
        sortOrder: index,
      })),
      createdAt: now,
      updatedAt: now,
    };
    demoRecipes.set(id, recipe);
    return recipe;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      title,
      source_url: input.sourceUrl?.trim() || null,
      source_name: input.sourceName?.trim() || null,
      attribution: input.attribution?.trim() || null,
      servings: input.servings,
      prep_minutes: input.prepMinutes ?? null,
      cook_minutes: input.cookMinutes ?? null,
      cuisine: input.cuisine?.trim() || null,
      cooking_method: input.cookingMethod?.trim() || null,
      instructions: input.instructions?.trim() || null,
      notes: input.notes?.trim() || null,
      is_favourite: Boolean(input.isFavourite),
      freezer_suitable: Boolean(input.freezerSuitable),
      leftover_friendly: Boolean(input.leftoverFriendly),
      dietary_tags: input.dietaryTags ?? [],
      variation_of_recipe_id: input.variationOfRecipeId ?? null,
      created_by: userId ?? null,
    })
    .select(
      "id, household_id, title, source_url, source_name, attribution, servings, prep_minutes, cook_minutes, cuisine, cooking_method, instructions, notes, is_favourite, freezer_suitable, leftover_friendly, dietary_tags, variation_of_recipe_id, created_at, updated_at",
    )
    .single();

  if (error) throw toDbError(error, "Could not save recipe.");

  const ingredientRows = input.ingredients.map((ingredient, index) => ({
    recipe_id: data.id,
    household_id: householdId,
    name: ingredient.name.trim(),
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    ingredient_key: toIngredientKey(ingredient.name),
    notes: ingredient.notes ?? null,
    optional: Boolean(ingredient.optional),
    sort_order: index,
  }));

  const { data: ingredients, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .insert(ingredientRows)
    .select(
      "id, name, quantity, unit, ingredient_key, notes, optional, sort_order",
    );

  if (ingredientError) {
    throw toDbError(ingredientError, "Could not save recipe ingredients.");
  }

  return mapRecipe(
    data as DbRecipe,
    ((ingredients ?? []) as DbIngredient[]).map(mapIngredient),
  );
}

export async function updateRecipe(
  householdId: string,
  recipeId: string,
  input: RecipeWriteInput,
): Promise<Recipe> {
  const title = input.title.trim();
  if (!title) throw new Error("Recipe title is required.");
  if (!input.ingredients?.length) {
    throw new Error("Add at least one ingredient.");
  }

  if (!isSupabaseConfigured()) {
    const existing = demoRecipes.get(recipeId);
    if (!existing || existing.householdId !== householdId) {
      throw new Error("Recipe not found.");
    }
    const updated: Recipe = {
      ...existing,
      title,
      sourceUrl: input.sourceUrl?.trim() || null,
      sourceName: input.sourceName?.trim() || null,
      attribution: input.attribution?.trim() || null,
      servings: input.servings,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      cuisine: input.cuisine?.trim() || null,
      cookingMethod: input.cookingMethod?.trim() || null,
      instructions: input.instructions?.trim() || null,
      notes: input.notes?.trim() || null,
      isFavourite: Boolean(input.isFavourite),
      freezerSuitable: Boolean(input.freezerSuitable),
      leftoverFriendly: Boolean(input.leftoverFriendly),
      dietaryTags: input.dietaryTags ?? [],
      variationOfRecipeId: input.variationOfRecipeId ?? null,
      ingredients: input.ingredients.map((ingredient, index) => ({
        id: crypto.randomUUID(),
        name: ingredient.name.trim(),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes ?? null,
        optional: Boolean(ingredient.optional),
        ingredientKey: toIngredientKey(ingredient.name),
        sortOrder: index,
      })),
      updatedAt: new Date().toISOString(),
    };
    demoRecipes.set(recipeId, updated);
    return updated;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update({
      title,
      source_url: input.sourceUrl?.trim() || null,
      source_name: input.sourceName?.trim() || null,
      attribution: input.attribution?.trim() || null,
      servings: input.servings,
      prep_minutes: input.prepMinutes ?? null,
      cook_minutes: input.cookMinutes ?? null,
      cuisine: input.cuisine?.trim() || null,
      cooking_method: input.cookingMethod?.trim() || null,
      instructions: input.instructions?.trim() || null,
      notes: input.notes?.trim() || null,
      is_favourite: Boolean(input.isFavourite),
      freezer_suitable: Boolean(input.freezerSuitable),
      leftover_friendly: Boolean(input.leftoverFriendly),
      dietary_tags: input.dietaryTags ?? [],
      variation_of_recipe_id: input.variationOfRecipeId ?? null,
    })
    .eq("id", recipeId)
    .eq("household_id", householdId)
    .select(
      "id, household_id, title, source_url, source_name, attribution, servings, prep_minutes, cook_minutes, cuisine, cooking_method, instructions, notes, is_favourite, freezer_suitable, leftover_friendly, dietary_tags, variation_of_recipe_id, created_at, updated_at",
    )
    .single();

  if (error) throw toDbError(error, "Could not update recipe.");

  await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("household_id", householdId);

  const { data: ingredients, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .insert(
      input.ingredients.map((ingredient, index) => ({
        recipe_id: recipeId,
        household_id: householdId,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        ingredient_key: toIngredientKey(ingredient.name),
        notes: ingredient.notes ?? null,
        optional: Boolean(ingredient.optional),
        sort_order: index,
      })),
    )
    .select(
      "id, name, quantity, unit, ingredient_key, notes, optional, sort_order",
    );

  if (ingredientError) {
    throw toDbError(ingredientError, "Could not update ingredients.");
  }

  return mapRecipe(
    data as DbRecipe,
    ((ingredients ?? []) as DbIngredient[]).map(mapIngredient),
  );
}

export async function deleteRecipe(
  householdId: string,
  recipeId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const existing = demoRecipes.get(recipeId);
    if (!existing || existing.householdId !== householdId) {
      throw new Error("Recipe not found.");
    }
    demoRecipes.delete(recipeId);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("household_id", householdId);
  if (error) throw toDbError(error, "Could not delete recipe.");
}
