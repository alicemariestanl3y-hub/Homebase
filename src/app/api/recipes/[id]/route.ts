import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import {
  deleteRecipe,
  getRecipe,
  updateRecipe,
} from "@/lib/recipes/repository";
import type { RecipeWriteInput } from "@/lib/recipes/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toDbError } from "@/lib/inventory/db-error";

type Params = { params: Promise<{ id: string }> };

async function requireHousehold() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
    }
  }
  const household = await resolveHouseholdIdForRequest();
  if (!household.householdId) {
    return {
      error: NextResponse.json(
        { error: household.error ?? "No household." },
        { status: 400 },
      ),
    };
  }
  return { householdId: household.householdId };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const gate = await requireHousehold();
    if ("error" in gate && gate.error) return gate.error;
    const { id } = await params;
    const recipe = await getRecipe(gate.householdId!, id);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  } catch (error) {
    return NextResponse.json(
      { error: toDbError(error, "Could not load recipe.").message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const gate = await requireHousehold();
    if ("error" in gate && gate.error) return gate.error;
    const { id } = await params;
    const body = (await request.json()) as RecipeWriteInput;
    const recipe = await updateRecipe(gate.householdId!, id, body);
    return NextResponse.json({ recipe });
  } catch (error) {
    return NextResponse.json(
      { error: toDbError(error, "Could not update recipe.").message },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const gate = await requireHousehold();
    if ("error" in gate && gate.error) return gate.error;
    const { id } = await params;
    await deleteRecipe(gate.householdId!, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: toDbError(error, "Could not delete recipe.").message },
      { status: 400 },
    );
  }
}
