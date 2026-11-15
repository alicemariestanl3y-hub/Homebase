import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import type { CapturedCandidate } from "./types";

const MODEL = "gpt-4o-mini";

type VisionItem = {
  name?: string;
  brand?: string | null;
  packageSize?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expiresOn?: string | null;
  suggestedLocation?: string | null;
  confidence?: string | null;
  needsReview?: boolean | null;
  notes?: string | null;
  sourceImageIndex?: number | null;
};

const SYSTEM_PROMPT = `You identify grocery products visible in household photos (pantry shelves, fridge shelves, freezer contents, shopping bags).

Rules:
- Only report products you can actually see.
- Prefer specific product names when readable (e.g. "Full cream milk").
- Extract brand and package size only when visible on packaging.
- Extract expiry/best-before dates ONLY when clearly readable as printed dates. Never invent or estimate expiry dates. If unsure, set expiresOn to null.
- Suggest location as one of: pantry, fridge, freezer based on context/packaging.
- quantity/unit: count visible packages when clear; otherwise quantity 1 with a sensible unit from: g, kg, ml, L, pieces, packets, bottles, cans.
- Mark needsReview true and confidence "low" or "medium" when uncertain. Do not invent brands or sizes.
- Return JSON only: { "items": [ ... ] }`;

function asUnit(value: string | null | undefined): InventoryUnit {
  if (value && (INVENTORY_UNITS as readonly string[]).includes(value)) {
    return value as InventoryUnit;
  }
  return "pieces";
}

function asLocation(value: string | null | undefined): LocationType {
  if (value === "pantry" || value === "fridge" || value === "freezer") {
    return value;
  }
  return "pantry";
}

function asConfidence(value: string | null | undefined): CapturedCandidate["confidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function normalizeExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Accept only YYYY-MM-DD — never invent a date from partial text.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export function mapVisionItems(raw: VisionItem[]): CapturedCandidate[] {
  return raw
    .map((item, index) => {
      const name = (item.name ?? "").trim();
      if (!name) return null;
      const confidence = asConfidence(item.confidence);
      const needsReview =
        item.needsReview === true ||
        confidence !== "high" ||
        !item.quantity ||
        item.quantity <= 0;

      const candidate: CapturedCandidate = {
        id: `cap_${index}_${crypto.randomUUID().slice(0, 8)}`,
        name,
        brand: item.brand?.trim() || null,
        packageSize: item.packageSize?.trim() || null,
        quantity:
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : 1,
        unit: asUnit(item.unit),
        expiresOn: normalizeExpiry(item.expiresOn),
        suggestedLocation: asLocation(item.suggestedLocation),
        confidence,
        needsReview,
        notes: item.notes?.trim() || null,
        sourceImageIndex:
          typeof item.sourceImageIndex === "number" ? item.sourceImageIndex : 0,
        selected: true,
        mergeWithItemId: null,
      };
      return candidate;
    })
    .filter((item): item is CapturedCandidate => item !== null);
}

/**
 * Call OpenAI vision (gpt-4o-mini) with already-resized JPEG data URLs.
 * Images are not stored — only the JSON candidates are returned.
 */
export async function analyzeGroceryImages(params: {
  apiKey: string;
  dataUrls: string[];
}): Promise<{ candidates: CapturedCandidate[]; model: string }> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [
    {
      type: "text",
      text: `Analyze these ${params.dataUrls.length} grocery photo(s). Return JSON with an "items" array. Use sourceImageIndex 0..${params.dataUrls.length - 1}.`,
    },
  ];

  for (const url of params.dataUrls) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "low" },
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vision API failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Vision API returned an empty response.");

  let parsed: { items?: VisionItem[] };
  try {
    parsed = JSON.parse(text) as { items?: VisionItem[] };
  } catch {
    throw new Error("Vision API returned invalid JSON.");
  }

  return {
    candidates: mapVisionItems(parsed.items ?? []),
    model: MODEL,
  };
}

export const CAPTURE_VISION_MODEL = MODEL;
