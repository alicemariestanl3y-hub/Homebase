import type { ProductKind } from "./types";

export type RecognitionResult = {
  suggestedKind: ProductKind;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * Suggest recipe_base / meal_kit / cooking_sauce without classifying every
 * pantry condiment. Conservative: clear packet-meal signals only.
 */
export function recognizePackagedMealProduct(input: {
  name: string;
  brand?: string | null;
  notes?: string | null;
}): RecognitionResult {
  const haystack = `${input.brand ?? ""} ${input.name} ${input.notes ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ");

  // Explicit meal kits (multi-component packs).
  if (
    /\b(meal kit|dinner kit|taco kit|burrito kit|fajita kit|nacho kit|kit dinner)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "meal_kit",
      confidence: "high",
      reason: "Name describes a multi-component meal kit.",
    };
  }

  // Mingle and similar dedicated recipe-base brands (incl. satay, etc.).
  if (
    /\bmingle\b/.test(haystack) &&
    /\b(recipe base|base|sachet|seasoning|simmer|curry|butter chicken|tikka|chow|stir.?fry|taco|ramen|satay|teriyaki|rendang|laksa|massaman|korma)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "recipe_base",
      confidence: "high",
      reason: "Mingle-style recipe base / seasoning packet.",
    };
  }

  if (/\bmingle\b/.test(haystack)) {
    return {
      suggestedKind: "recipe_base",
      confidence: "medium",
      reason: "Mingle brand — likely a recipe base; confirm on the packet.",
    };
  }

  // Clear recipe-base wording.
  if (
    /\b(recipe base|recipe mix|meal base|curry kit|slow cooker base)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "recipe_base",
      confidence: "high",
      reason: "Labelled as a recipe/meal base.",
    };
  }

  // Cooking / simmer sauces sold as a complete meal flavour base.
  if (
    /\b(simmer sauce|cooking sauce|stir.?fry sauce|curry sauce)\b/.test(
      haystack,
    ) &&
    !/\b(soy sauce|fish sauce|hot sauce|worcestershire|oyster sauce)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "cooking_sauce",
      confidence: "medium",
      reason: "Packaged cooking/simmer sauce used as a meal base.",
    };
  }

  // Old El Paso / Mission dinner kits.
  if (
    /\b(old el paso|mission)\b/.test(haystack) &&
    /\b(kit|soft taco|stand.?n.?stuff|dinner)\b/.test(haystack)
  ) {
    return {
      suggestedKind: "meal_kit",
      confidence: "medium",
      reason: "Mexican dinner kit style product.",
    };
  }

  // Do NOT auto-classify generic sauces, pastes, spices, or plain seasonings.
  if (
    /\b(hot sauce|soy sauce|fish sauce|worcestershire|ketchup|mayonnaise|mustard|vinegar|oil|salt|pepper|spice|herbs?|paste)\b/.test(
      haystack,
    ) &&
    !/\b(recipe base|meal kit|dinner kit|simmer sauce|cooking sauce)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "standard",
      confidence: "medium",
      reason: "Looks like a pantry condiment/spice, not a packet meal.",
    };
  }

  return {
    suggestedKind: "unclassified",
    confidence: "low",
    reason: "No clear recipe-base or meal-kit signal — leave unclassified.",
  };
}

export function detectAllergenMentions(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const checks: Array<[string, RegExp]> = [
    ["garlic", /\bgarlic\b/],
    ["cashew", /\bcashews?\b/],
    ["pistachio", /\bpistachios?\b/],
    ["peanut", /\bpeanuts?\b/],
    ["tree_nut", /\b(tree nuts?|almonds?|walnuts?|hazelnuts?)\b/],
    ["dairy", /\b(milk|cream|butter|dairy|lactose)\b/],
    ["gluten", /\b(gluten|wheat|barley|rye)\b/],
  ];
  for (const [key, pattern] of checks) {
    if (pattern.test(lower)) found.push(key);
  }
  return found;
}

/** Maps catalog kind to the recipe_type used for Meals library rows. */
export function recipeTypeForProductKind(
  kind: ProductKind,
): "traditional" | "recipe_base" | "meal_kit" {
  if (kind === "meal_kit") return "meal_kit";
  if (kind === "recipe_base" || kind === "cooking_sauce") return "recipe_base";
  return "traditional";
}
