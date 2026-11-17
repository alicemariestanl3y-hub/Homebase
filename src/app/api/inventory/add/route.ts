import { NextResponse } from "next/server";
import { performAddInventoryItem } from "@/lib/inventory/perform-mutations";

/**
 * Manual inventory add via Route Handler (not a Server Action).
 * Same rationale as /api/auth/* and /api/capture/analyze — Server Action
 * POSTs on this host can fail before business logic runs.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performAddInventoryItem({
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
      error instanceof Error ? error.message : "Could not add item.";
    return NextResponse.json(
      { error: message, ok: false },
      { status: 500 },
    );
  }
}
