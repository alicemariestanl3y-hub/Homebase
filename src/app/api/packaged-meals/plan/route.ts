import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { toDbError } from "@/lib/inventory/db-error";
import { shoppingLinesForRecommendation } from "@/lib/packaged-meals/shopping";
import { appendDemoShoppingLines } from "@/lib/packaged-meals/shopping-store";
import type { MealRecommendation } from "@/lib/packaged-meals/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type PlanBody = {
  recommendation: MealRecommendation;
  plannedDate?: string;
  mealSlot?: string;
  servings?: number;
};

export async function POST(request: Request) {
  try {
    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as PlanBody;
    if (!body.recommendation?.recipeId) {
      return NextResponse.json(
        { error: "Pick a meal recommendation first." },
        { status: 400 },
      );
    }

    const plannedDate =
      body.plannedDate || new Date().toISOString().slice(0, 10);
    const lines = shoppingLinesForRecommendation(body.recommendation);

    if (!isSupabaseConfigured()) {
      appendDemoShoppingLines(
        household.householdId,
        lines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          notes: line.notes,
          fromRecipeId: line.fromRecipeId,
        })),
      );
      return NextResponse.json({
        ok: true,
        plannedDate,
        shoppingItemCount: lines.length,
        shoppingLines: lines,
        demo: true,
      });
    }

    const supabase = await createClient();
    const weekStart = startOfWeek(plannedDate);

    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .upsert(
        {
          household_id: household.householdId,
          week_start_date: weekStart,
          title: `Week of ${weekStart}`,
        },
        { onConflict: "household_id,week_start_date" },
      )
      .select("id")
      .single();
    if (planError) throw toDbError(planError, "Could not create meal plan.");

    const { error: entryError } = await supabase.from("meal_plan_entries").insert({
      meal_plan_id: plan.id,
      household_id: household.householdId,
      recipe_id: body.recommendation.recipeId,
      planned_date: plannedDate,
      meal_slot: body.mealSlot ?? "dinner",
      servings: body.servings ?? null,
      status: "planned",
      notes: body.recommendation.productLabel
        ? `Uses ${body.recommendation.productLabel}`
        : null,
    });
    if (entryError) throw toDbError(entryError, "Could not add meal plan entry.");

    let listId: string | null = null;
    const { data: existingList } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("household_id", household.householdId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingList?.id) {
      listId = existingList.id;
    } else {
      const { data: createdList, error: listError } = await supabase
        .from("shopping_lists")
        .insert({
          household_id: household.householdId,
          title: "Shopping list",
          meal_plan_id: plan.id,
          status: "open",
        })
        .select("id")
        .single();
      if (listError) throw toDbError(listError, "Could not create shopping list.");
      listId = createdList.id;
    }

    if (lines.length && listId) {
      const { error: itemsError } = await supabase
        .from("shopping_list_items")
        .insert(
          lines.map((line, index) => ({
            shopping_list_id: listId,
            household_id: household.householdId,
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            ingredient_key: line.ingredientKey,
            from_recipe_id: line.fromRecipeId,
            notes: line.notes,
            sort_order: index,
          })),
        );
      if (itemsError) {
        throw toDbError(itemsError, "Could not add shopping list items.");
      }
    }

    return NextResponse.json({
      ok: true,
      plannedDate,
      shoppingItemCount: lines.length,
      shoppingLines: lines,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not add meal to plan.",
      },
      { status: 500 },
    );
  }
}

function startOfWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}
