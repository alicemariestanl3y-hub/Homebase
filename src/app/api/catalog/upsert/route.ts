import { NextResponse } from "next/server";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { upsertCatalogProduct } from "@/lib/packaged-meals/repository";
import type { ProductKind } from "@/lib/packaged-meals/types";

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
      displayName?: string;
      brand?: string | null;
      variant?: string | null;
      packSize?: string | null;
      originalName?: string | null;
      productKind?: ProductKind;
      kindConfirmed?: boolean;
      notes?: string | null;
      sourceType?: string | null;
    };
    if (!body.displayName?.trim()) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 },
      );
    }
    const product = await upsertCatalogProduct({
      householdId: household.householdId,
      displayName: body.displayName,
      brand: body.brand,
      variant: body.variant,
      packSize: body.packSize,
      originalName: body.originalName,
      productKind: body.productKind,
      kindConfirmed: body.kindConfirmed,
      notes: body.notes,
      sourceType: body.sourceType ?? "manual",
    });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not save product.",
      },
      { status: 500 },
    );
  }
}
