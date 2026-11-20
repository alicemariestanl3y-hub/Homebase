import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryRepository } from "@/lib/inventory/get-repository";
import { confirmCookMeal } from "@/lib/packaged-meals/repository";
import type { CookConfirmInput } from "@/lib/packaged-meals/types";

export async function POST(request: Request) {
  try {
    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Omit<CookConfirmInput, "householdId">;
    if (!body.recipeId || !body.deductions?.length) {
      return NextResponse.json(
        { error: "Review deductions before confirming the cook." },
        { status: 400 },
      );
    }

    const confirmation = await confirmCookMeal({
      ...body,
      householdId: household.householdId,
      packetsUsed: Number(body.packetsUsed) || 1,
    });

    const repo = getInventoryRepository();
    for (const line of body.deductions) {
      if (line.amount <= 0) continue;
      await repo.consumeItem({
        householdId: household.householdId,
        itemId: line.inventoryItemId,
        amount: line.amount,
        note:
          line.role === "packet"
            ? "Used packet for cooked meal"
            : "Used for cooked meal",
      });
    }

    return NextResponse.json({ ok: true, ...confirmation });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not confirm cooked meal.",
      },
      { status: 500 },
    );
  }
}
