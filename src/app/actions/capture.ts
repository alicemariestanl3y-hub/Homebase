"use server";

/**
 * Capture save now goes through POST /api/capture/save.
 * Keep this wrapper for any leftover server-side callers.
 */
import type { CapturedCandidate } from "@/lib/capture/types";
import {
  performSaveCapturedItems,
  type SaveCaptureResult,
} from "@/lib/capture/perform-save";

export type SaveCaptureState = SaveCaptureResult;

export async function saveCapturedItems(
  candidates: CapturedCandidate[],
): Promise<SaveCaptureState> {
  return performSaveCapturedItems(candidates);
}
