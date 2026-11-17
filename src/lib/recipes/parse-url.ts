/**
 * Import recipe data from a public recipe page when the site exposes
 * schema.org Recipe JSON-LD (common on RecipeTin Eats and many blogs).
 * Never invents missing ingredients or quantities.
 */

import type { InventoryUnit } from "@/lib/inventory/types";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { RecipeIngredientInput, RecipeWriteInput } from "./types";

type JsonLdRecipe = {
  "@type"?: string | string[];
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown;
  recipeYield?: string | number;
  prepTime?: string;
  cookTime?: string;
  author?: { name?: string } | string;
  url?: string;
};

function isRecipeType(value: string | string[] | undefined): boolean {
  if (!value) return false;
  const types = Array.isArray(value) ? value : [value];
  return types.some((entry) => /recipe/i.test(entry));
}

function parseIsoDurationMinutes(value: string | undefined): number | null {
  if (!value) return null;
  // e.g. PT1H30M / PT45M
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function parseServings(value: string | number | undefined): number {
  if (typeof value === "number" && value > 0) return value;
  if (typeof value === "string") {
    const match = value.match(/(\d+(\.\d+)?)/);
    if (match) return Number(match[1]);
  }
  return 4;
}

function instructionsToText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const lines = value
      .map((step, index) => {
        if (typeof step === "string") return `${index + 1}. ${step}`;
        if (step && typeof step === "object" && "text" in step) {
          const text = String((step as { text?: string }).text ?? "").trim();
          return text ? `${index + 1}. ${text}` : null;
        }
        return null;
      })
      .filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : null;
  }
  if (typeof value === "object" && value && "text" in value) {
    const text = String((value as { text?: string }).text ?? "").trim();
    return text || null;
  }
  return null;
}

/** Best-effort parse of "2 cups milk" / "400g tomatoes" — leaves gaps null. */
export function parseIngredientLine(line: string): RecipeIngredientInput {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^(\d+[\/\.]?\d*)\s*(g|kg|ml|l|L|cups?|tsp|tbsp|tablespoons?|teaspoons?)?\s+(.+)$/i,
  );
  if (!match) {
    return { name: trimmed, quantity: null, unit: null };
  }

  const rawQty = match[1].includes("/")
    ? (() => {
        const [a, b] = match[1].split("/");
        return Number(a) / Number(b);
      })()
    : Number(match[1]);
  const rawUnit = (match[2] ?? "").toLowerCase();
  const name = match[3].trim();

  let unit: InventoryUnit | null = null;
  let quantity: number | null = Number.isFinite(rawQty) ? rawQty : null;

  if ((INVENTORY_UNITS as readonly string[]).includes(rawUnit)) {
    unit = rawUnit as InventoryUnit;
  } else if (rawUnit === "l") {
    unit = "L";
  } else {
    // Cups/tsp/tbsp are not in inventory units — keep name intact, no invented conversion.
    return { name: trimmed, quantity: null, unit: null };
  }

  return { name, quantity, unit };
}

function collectJsonLdNodes(payload: unknown, out: JsonLdRecipe[]) {
  if (!payload) return;
  if (Array.isArray(payload)) {
    for (const entry of payload) collectJsonLdNodes(entry, out);
    return;
  }
  if (typeof payload !== "object") return;
  const row = payload as JsonLdRecipe & { "@graph"?: unknown };
  if (isRecipeType(row["@type"])) out.push(row);
  if (row["@graph"]) collectJsonLdNodes(row["@graph"], out);
}

export function extractRecipesFromHtml(html: string): JsonLdRecipe[] {
  const recipes: JsonLdRecipe[] = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    const raw = match[1].trim();
    try {
      collectJsonLdNodes(JSON.parse(raw), recipes);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return recipes;
}

export function mapJsonLdToRecipeInput(
  recipe: JsonLdRecipe,
  sourceUrl: string,
): RecipeWriteInput | null {
  const title = (recipe.name ?? "").trim();
  if (!title) return null;

  const ingredientLines = (recipe.recipeIngredient ?? [])
    .map((line) => line.trim())
    .filter(Boolean);
  if (ingredientLines.length === 0) return null;

  const author =
    typeof recipe.author === "string"
      ? recipe.author
      : recipe.author?.name?.trim() || null;

  return {
    title,
    sourceUrl,
    sourceName: author,
    attribution: author
      ? `${author} — ${sourceUrl}`
      : `Imported from ${sourceUrl}`,
    servings: parseServings(recipe.recipeYield),
    prepMinutes: parseIsoDurationMinutes(recipe.prepTime),
    cookMinutes: parseIsoDurationMinutes(recipe.cookTime),
    instructions: instructionsToText(recipe.recipeInstructions),
    ingredients: ingredientLines.map(parseIngredientLine),
    isFavourite: false,
    freezerSuitable: false,
    leftoverFriendly: false,
    dietaryTags: [],
  };
}

export async function importRecipeFromUrl(
  sourceUrl: string,
): Promise<{ recipe: RecipeWriteInput | null; error: string | null }> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return { recipe: null, error: "Enter a valid recipe website URL." };
  }
  if (!/^https?:$/i.test(url.protocol)) {
    return { recipe: null, error: "Only http(s) recipe URLs are supported." };
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "HomeBaseRecipeImport/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return {
      recipe: null,
      error: "Could not reach that website. Paste the recipe manually instead.",
    };
  }

  if (!response.ok) {
    return {
      recipe: null,
      error: `Website returned ${response.status}. Paste the recipe manually instead.`,
    };
  }

  const html = await response.text();
  const recipes = extractRecipesFromHtml(html);
  if (recipes.length === 0) {
    return {
      recipe: null,
      error:
        "No structured recipe data found on that page (JSON-LD Recipe). Paste ingredients manually — we won’t invent them.",
    };
  }

  const mapped = mapJsonLdToRecipeInput(recipes[0], url.toString());
  if (!mapped) {
    return {
      recipe: null,
      error:
        "The page had recipe markup but no usable title/ingredients. Paste manually.",
    };
  }
  return { recipe: mapped, error: null };
}
