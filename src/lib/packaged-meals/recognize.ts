import type { ProductKind } from "./types";

export type RecognitionResult = {
  suggestedKind: ProductKind;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * Suggest recipe_base / meal_kit without classifying every sauce/seasoning.
 * Conservative: only clear packet-meal signals (e.g. Mingle recipe bases, taco kits).
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

  // Mingle and similar dedicated recipe-base brands.
  if (
    /\bmingle\b/.test(haystack) &&
    /\b(recipe base|base|sachet|seasoning|simmer|curry|butter chicken|tikka|chow|stir.?fry|taco|ramen)\b/.test(
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

  // Clear "recipe base" / "cooking sauce for X serves" style products.
  if (
    /\b(recipe base|recipe mix|meal base|simmer sauce|curry kit|slow cooker base)\b/.test(
      haystack,
    )
  ) {
    return {
      suggestedKind: "recipe_base",
      confidence: "high",
      reason: "Labelled as a recipe/meal base.",
    };
  }

  // Old El Paso / Mission dinner kits often named "Stand 'N Stuff" etc.
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
    !/\b(recipe base|meal kit|dinner kit)\b/.test(haystack)
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
