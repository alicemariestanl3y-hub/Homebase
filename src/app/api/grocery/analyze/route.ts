import { NextResponse } from "next/server";
import {
  extractGroceryFromImages,
  extractGroceryFromText,
} from "@/lib/grocery/extract";
import { findDuplicateGroceryImport } from "@/lib/grocery/perform-save";
import { detectWoolworthsContent } from "@/lib/grocery/retailers/woolworths";
import type { GrocerySourceType } from "@/lib/grocery/types";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { takeCaptureRateLimit } from "@/lib/capture/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getOpenAiApiKey, isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Sign in with Supabase configured to import groceries." },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in to import groceries." },
        { status: 401 },
      );
    }

    const rate = takeCaptureRateLimit(user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Too many import requests. Try again in ${rate.retryAfterSec}s.`,
        },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      sourceType?: GrocerySourceType;
      text?: string;
      images?: string[];
      sourceLabel?: string;
    };

    const sourceType = body.sourceType ?? "pasted_list";
    const text = String(body.text ?? "");
    const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    const woolworthsText =
      (sourceType === "pasted_list" || sourceType === "email") &&
      detectWoolworthsContent(text);

    const apiKey = getOpenAiApiKey();
    // Woolworths HTML/text can parse without OpenAI; screenshots still need it.
    if (!apiKey && !woolworthsText) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    let result;
    if (sourceType === "pasted_list" || sourceType === "email") {
      result = await extractGroceryFromText({
        apiKey: apiKey ?? "unused-for-woolworths-parser",
        text,
        sourceType,
      });
    } else {
      result = await extractGroceryFromImages({
        apiKey: apiKey!,
        images,
        sourceType,
      });
    }

    const household = await resolveHouseholdIdForRequest();
    const duplicateImportId = household.householdId
      ? await findDuplicateGroceryImport(
          household.householdId,
          result.contentHash,
        )
      : null;

    return NextResponse.json({
      candidates: result.candidates,
      contentHash: result.contentHash,
      fulfillment: result.fulfillment,
      retailer: result.retailer,
      retailerCode: result.retailerCode,
      orderReference: result.orderReference,
      currency: result.currency,
      orderTotal: result.orderTotal,
      model: result.model,
      parser: result.parser,
      duplicateImportId,
      warning: duplicateImportId
        ? "This looks like an order you already imported."
        : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Grocery analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
