import { NextResponse } from "next/server";
import { performConsumeInventoryItem } from "@/lib/inventory/perform-mutations";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performConsumeInventoryItem({
      itemId: String(formData.get("itemId") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update quantity.";
    return NextResponse.json(
      { error: message, ok: false },
      { status: 500 },
    );
  }
}
