import { NextResponse } from "next/server";
import { takeCaptureRateLimit } from "@/lib/capture/rate-limit";
import { extractPacketRecipeFromImages } from "@/lib/packaged-meals/extract-packet-recipe";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: Request) {
  try {
    let userId = "demo";
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: "Sign in to read packet recipes." },
          { status: 401 },
        );
      }
      userId = user.id;
    }

    const limited = takeCaptureRateLimit(userId);
    if (!limited.allowed) {
      return NextResponse.json(
        {
          error: `Too many requests. Try again in ${limited.retryAfterSec}s.`,
        },
        { status: 429 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          draft: {
            title: null,
            servings: null,
            packetsRequired: 1,
            instructions: null,
            included: [],
            additionalIngredients: [],
            source: "unavailable",
            notes:
              "OPENAI_API_KEY is not configured. Paste packet instructions manually.",
          },
        },
        { status: 200 },
      );
    }

    const body = (await request.json()) as {
      images?: string[];
      productName?: string;
      brand?: string | null;
    };

    if (!body.productName?.trim()) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 },
      );
    }

    const draft = await extractPacketRecipeFromImages({
      apiKey,
      dataUrls: (body.images ?? []).slice(0, 4),
      productName: body.productName.trim(),
      brand: body.brand ?? null,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read packet recipe.",
      },
      { status: 500 },
    );
  }
}
