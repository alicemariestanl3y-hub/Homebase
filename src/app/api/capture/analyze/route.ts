import { NextResponse } from "next/server";
import { takeCaptureRateLimit } from "@/lib/capture/rate-limit";
import {
  analyzeGroceryImages,
  CAPTURE_VISION_MODEL,
} from "@/lib/capture/vision";
import { createClient } from "@/lib/supabase/server";
import { getOpenAiApiKey, isSupabaseConfigured } from "@/lib/supabase/env";

const MAX_IMAGES = 6;
const MAX_DATA_URL_CHARS = 1_800_000;

/**
 * Authenticated vision analysis endpoint.
 * Always requires a signed-in Supabase user when the app is live.
 * In true demo mode (no Supabase), analysis is disabled to avoid unpaid API abuse.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Smart Capture requires a connected Supabase household. Sign in on the live app, then try again.",
        },
        { status: 401 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const limit = takeCaptureRateLimit(user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Too many capture requests. Try again in ${limit.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        },
      );
    }

    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured. Add it as a Cursor app secret to enable Smart Capture.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { images?: string[] };
    const images = Array.isArray(body.images) ? body.images : [];

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Add at least one photo." },
        { status: 400 },
      );
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Please upload at most ${MAX_IMAGES} photos at a time.` },
        { status: 400 },
      );
    }

    for (const image of images) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Invalid image payload." },
          { status: 400 },
        );
      }
      if (image.length > MAX_DATA_URL_CHARS) {
        return NextResponse.json(
          {
            error:
              "An image is still too large after resize. Try a closer photo.",
          },
          { status: 400 },
        );
      }
    }

    const { candidates, model } = await analyzeGroceryImages({
      apiKey,
      dataUrls: images,
    });

    return NextResponse.json({
      candidates,
      model: model || CAPTURE_VISION_MODEL,
      imageCount: images.length,
      warning:
        candidates.length === 0
          ? "No products were confidently identified. Try a clearer photo."
          : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capture analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
