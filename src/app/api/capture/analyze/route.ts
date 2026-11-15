import { NextResponse } from "next/server";
import {
  analyzeGroceryImages,
  CAPTURE_VISION_MODEL,
} from "@/lib/capture/vision";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { createClient } from "@/lib/supabase/server";
import { getOpenAiApiKey, isSupabaseConfigured } from "@/lib/supabase/env";

const MAX_IMAGES = 6;
const MAX_DATA_URL_CHARS = 1_800_000; // ~after client resize

/**
 * Authenticated vision analysis endpoint.
 * Accepts resized JPEG data URLs, returns candidates, discards images.
 */
export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
    } else if (getInventoryMode() !== "demo") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
      return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Please upload at most ${MAX_IMAGES} photos at a time.` },
        { status: 400 },
      );
    }

    for (const image of images) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return NextResponse.json({ error: "Invalid image payload." }, { status: 400 });
      }
      if (image.length > MAX_DATA_URL_CHARS) {
        return NextResponse.json(
          { error: "An image is still too large after resize. Try a closer photo." },
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
