import { NextResponse } from "next/server";
import { performDeleteInventoryItem } from "@/lib/inventory/perform-mutations";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performDeleteInventoryItem({
      itemId: String(formData.get("itemId") ?? ""),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove item.";
    return NextResponse.json(
      { error: message, ok: false },
      { status: 500 },
    );
  }
}
