import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/recipes/parse-url";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }
    }

    const body = (await request.json()) as { url?: string };
    const result = await importRecipeFromUrl(String(body.url ?? ""));
    if (result.error || !result.recipe) {
      return NextResponse.json(
        { error: result.error ?? "Could not import recipe." },
        { status: 400 },
      );
    }
    return NextResponse.json({ recipe: result.recipe });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe URL import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
