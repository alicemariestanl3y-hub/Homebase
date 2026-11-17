import { NextResponse } from "next/server";
import type { CapturedCandidate } from "@/lib/capture/types";
import { performSaveCapturedItems } from "@/lib/capture/perform-save";

/**
 * Save approved Smart Capture items via Route Handler.
 * Analyze already uses /api/capture/analyze successfully; save must follow
 * the same path (not a Server Action) so it reaches Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      candidates?: CapturedCandidate[];
    };
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const result = await performSaveCapturedItems(candidates);
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not save captured items.";
    return NextResponse.json(
      { error: message, savedCount: 0 },
      { status: 500 },
    );
  }
}
