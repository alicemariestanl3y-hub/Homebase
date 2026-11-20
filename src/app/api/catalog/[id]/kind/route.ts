import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { updateCatalogProductKind } from "@/lib/packaged-meals/repository";
import type { ProductKind } from "@/lib/packaged-meals/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const household = await resolveHouseholdIdForRequest();
    if (!household.householdId) {
      return NextResponse.json(
        { error: household.error ?? "No household found." },
        { status: 401 },
      );
    }
    const body = (await request.json()) as { productKind?: ProductKind };
    if (
      !body.productKind ||
      !["standard", "recipe_base", "meal_kit", "unclassified"].includes(
        body.productKind,
      )
    ) {
      return NextResponse.json(
        { error: "Choose a valid product classification." },
        { status: 400 },
      );
    }
    const product = await updateCatalogProductKind(
      household.householdId,
      id,
      body.productKind,
    );
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update classification.",
      },
      { status: 500 },
    );
  }
}
