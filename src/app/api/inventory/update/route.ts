import { NextResponse } from "next/server";
import { performUpdateInventoryItem } from "@/lib/inventory/perform-mutations";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performUpdateInventoryItem({
      itemId: String(formData.get("itemId") ?? ""),
      name: String(formData.get("name") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      locationType: String(formData.get("locationType") ?? ""),
      expiresOn: String(formData.get("expiresOn") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update item.";
    return NextResponse.json(
      { error: message, ok: false },
      { status: 500 },
    );
  }
}
