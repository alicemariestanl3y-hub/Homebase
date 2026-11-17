import { NextResponse } from "next/server";
import { performSaveGroceryImport } from "@/lib/grocery/perform-save";
import type { GrocerySavePayload } from "@/lib/grocery/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GrocerySavePayload;
    const result = await performSaveGroceryImport(body);
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save grocery import.";
    return NextResponse.json(
      {
        error: message,
        savedCount: 0,
        importId: null,
        duplicate: false,
      },
      { status: 500 },
    );
  }
}
