import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { createVerifiedPackagedMeal } from "@/lib/packaged-meals/repository";
import type {
  AllergenStatus,
  PackagedMealWriteInput,
} from "@/lib/packaged-meals/types";

export async function POST(request: Request) {
  try {
    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Omit<
      PackagedMealWriteInput,
      "householdId"
    > & { allergenStatus?: AllergenStatus };

    if (!body.catalogProductId) {
      return NextResponse.json(
        { error: "Pick the packaged product first." },
        { status: 400 },
      );
    }
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Meal title is required." },
        { status: 400 },
      );
    }
    if (!body.instructions?.trim()) {
      return NextResponse.json(
        {
          error:
            "Paste the packet cooking instructions. HomeBase will not invent them.",
        },
        { status: 400 },
      );
    }

    const result = await createVerifiedPackagedMeal({
      ...body,
      householdId: household.householdId,
      servingsPerPacket: Number(body.servingsPerPacket) || 4,
      packetsRequired: Number(body.packetsRequired) || 1,
      instructionsSource: body.instructionsSource ?? "user_typed",
      included: body.included ?? [],
      additionalIngredients: body.additionalIngredients ?? [],
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify packaged meal.",
      },
      { status: 500 },
    );
  }
}
