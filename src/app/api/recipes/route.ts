import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { createRecipe, listRecipes } from "@/lib/recipes/repository";
import type { RecipeWriteInput } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toDbError } from "@/lib/inventory/db-error";

export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }
    }

    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household." },
        { status: 400 },
      );
    }

    const recipes = await listRecipes(household.householdId);
    return NextResponse.json({ recipes });
  } catch (error) {
    return NextResponse.json(
      { error: toDbError(error, "Could not load recipes.").message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let userId: string | null = null;
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }
      userId = user.id;
    }

    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as RecipeWriteInput;
    const recipe = await createRecipe(household.householdId, body, userId);
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: toDbError(error, "Could not save recipe.").message },
      { status: 400 },
    );
  }
}
