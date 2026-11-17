import { createHash } from "node:crypto";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { toIngredientKey } from "@/lib/ingredients/matching";
import { hashGroceryContent } from "./hash";
import {
  detectWoolworthsContent,
  isLikelyNonFood,
  parseWoolworthsEmail,
  standardizeWoolworthsName,
  WOOLWORTHS_RETAILER_CODE,
} from "./retailers/woolworths";
import type {
  GroceryCandidate,
  GroceryFulfillment,
  GroceryLineFulfillment,
  GroceryRetailerCode,
  GrocerySourceType,
} from "./types";

const MODEL = "gpt-4o-mini";

type RawLine = {
  name?: string;
  originalName?: string | null;
  standardizedName?: string | null;
  brand?: string | null;
  packageSize?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  linePrice?: number | null;
  suggestedLocation?: string | null;
  lineFulfillment?: string | null;
  isFood?: boolean | null;
  wasSubstituted?: boolean | null;
  substitutionNote?: string | null;
  confidence?: string | null;
  needsReview?: boolean | null;
  notes?: string | null;
};

type RawExtract = {
  retailer?: string | null;
  orderReference?: string | null;
  fulfillment?: string | null;
  orderTotal?: number | null;
  items?: RawLine[];
};

const SYSTEM_PROMPT = `You extract itemised grocery order / receipt lines for a household inventory app (Australia).

Woolworths Australia emails often use an HTML table with columns:
Item description | Unit price | Qty | Price
Descriptions may wrap onto multiple lines (name then pack size). Join those into one product.

Rules:
- Only report products explicitly present. Never invent products, pack sizes, brands, prices or expiry dates.
- Preserve originalName exactly as printed (joined multi-line text).
- Also provide standardizedName: a cleaner ingredient-style name for recipe matching (drop marketing fluff, keep product identity).
- Extract unitPrice and linePrice as numbers when shown (no currency symbol). currency is AUD for Woolworths.
- If quantity/unit is unclear, quantity=1, unit="pieces", needsReview=true, confidence="low".
- unit must be one of: g, kg, ml, L, pieces, packets, bottles, cans.
- suggestedLocation: pantry | fridge | freezer.
- isFood: false for cleaning, toiletries, bags, pet non-food, magazines, etc. Non-food should still be listed.
- wasSubstituted: true when the line indicates a substitution.
- lineFulfillment: delivered for receipts / completed orders; ordered for pending confirmations.
- fulfillment (order-level): ordered | delivered | mixed | unknown.
- Return JSON only:
  { "retailer": string|null, "orderReference": string|null, "fulfillment": "...", "orderTotal": number|null,
    "items": [{ "name", "originalName", "standardizedName", "brand", "packageSize", "quantity", "unit",
      "unitPrice", "linePrice", "suggestedLocation", "lineFulfillment", "isFood", "wasSubstituted",
      "substitutionNote", "confidence", "needsReview", "notes" }] }`;

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

function asConfidence(
  value: string | null | undefined,
): GroceryCandidate["confidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function asLineFulfillment(
  value: string | null | undefined,
  fallback: GroceryLineFulfillment,
): GroceryLineFulfillment {
  if (value === "ordered" || value === "delivered") return value;
  return fallback;
}

function asFulfillment(value: string | null | undefined): GroceryFulfillment {
  if (
    value === "ordered" ||
    value === "delivered" ||
    value === "mixed" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function asMoney(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function mapGroceryItems(
  raw: RawLine[],
  defaultLineFulfillment: GroceryLineFulfillment = "delivered",
): GroceryCandidate[] {
  return raw
    .map((item, index) => {
      const originalName = (item.originalName ?? item.name ?? "").trim();
      if (!originalName) return null;
      const standardizedName = (
        item.standardizedName ??
        standardizeWoolworthsName(originalName)
      ).trim();
      const confidence = asConfidence(item.confidence);
      const quantity =
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 1;
      const unit = asUnit(item.unit);
      const isFood =
        typeof item.isFood === "boolean"
          ? item.isFood
          : !isLikelyNonFood(originalName);
      const needsReview =
        item.needsReview === true ||
        confidence !== "high" ||
        !isFood ||
        !(typeof item.quantity === "number" && item.quantity > 0) ||
        !(
          item.unit &&
          (INVENTORY_UNITS as readonly string[]).includes(item.unit)
        );

      const candidate: GroceryCandidate = {
        id: `groc_${index}_${crypto.randomUUID().slice(0, 8)}`,
        name: originalName,
        originalName,
        standardizedName,
        brand: item.brand?.trim() || null,
        packageSize: item.packageSize?.trim() || null,
        quantity,
        unit,
        unitPrice: asMoney(item.unitPrice),
        linePrice: asMoney(item.linePrice),
        currency: "AUD",
        suggestedLocation: asLocation(item.suggestedLocation),
        lineFulfillment: asLineFulfillment(
          item.lineFulfillment,
          defaultLineFulfillment,
        ),
        isFood,
        wasSubstituted: item.wasSubstituted === true,
        substitutionNote: item.substitutionNote?.trim() || null,
        confidence,
        needsReview,
        notes: item.notes?.trim() || null,
        ingredientKey: toIngredientKey(standardizedName || originalName),
        selected: isFood,
        mergeWithItemId: null,
      };
      return candidate;
    })
    .filter((item): item is GroceryCandidate => item !== null);
}

export function contentHashFromCandidates(
  candidates: GroceryCandidate[],
  extra: string[] = [],
): string {
  const lines = candidates
    .map(
      (item) =>
        `${item.originalName ?? item.name}|${item.quantity}|${item.unit}|${item.linePrice ?? ""}|${item.packageSize ?? ""}`,
    )
    .sort();
  return hashGroceryContent([...extra, ...lines]);
}

export function contentHashFromRawInput(input: {
  text?: string;
  imageFingerprints?: string[];
  orderReference?: string | null;
}): string {
  return hashGroceryContent([
    input.orderReference ?? "",
    input.text ?? "",
    ...(input.imageFingerprints ?? []),
  ]);
}

export function fingerprintDataUrl(dataUrl: string): string {
  return createHash("sha256").update(dataUrl.slice(0, 5000)).digest("hex");
}

export type GroceryExtractResult = {
  candidates: GroceryCandidate[];
  fulfillment: GroceryFulfillment;
  retailer: string | null;
  retailerCode: GroceryRetailerCode | null;
  orderReference: string | null;
  currency: string;
  orderTotal: number | null;
  contentHash: string;
  model: string | null;
  parser: "woolworths_html" | "openai_vision" | "openai_text";
};

async function callOpenAiJson(args: {
  apiKey: string;
  userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
}): Promise<RawExtract> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: args.userContent },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Grocery import AI failed (${response.status}): ${detail.slice(0, 240)}`,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grocery import AI returned an empty response.");

  try {
    return JSON.parse(content) as RawExtract;
  } catch {
    throw new Error("Grocery import AI returned invalid JSON.");
  }
}

export async function extractGroceryFromText(args: {
  apiKey: string;
  text: string;
  sourceType: GrocerySourceType;
}): Promise<GroceryExtractResult> {
  const trimmed = args.text.trim();
  if (!trimmed) throw new Error("Paste an itemised grocery list first.");

  // Deterministic Woolworths path — no AI inventing pack sizes/prices.
  if (detectWoolworthsContent(trimmed)) {
    const parsed = parseWoolworthsEmail(trimmed);
    if (parsed.candidates.length > 0) {
      return {
        candidates: parsed.candidates,
        fulfillment: parsed.fulfillment,
        retailer: parsed.retailer,
        retailerCode: WOOLWORTHS_RETAILER_CODE,
        orderReference: parsed.orderReference,
        currency: parsed.currency,
        orderTotal: parsed.orderTotal,
        contentHash: contentHashFromRawInput({
          text: trimmed,
          orderReference: parsed.orderReference,
        }),
        model: null,
        parser: "woolworths_html",
      };
    }
  }

  const raw = await callOpenAiJson({
    apiKey: args.apiKey,
    userContent: [
      {
        type: "text",
        text: `Source type: ${args.sourceType}\n\nGrocery list / receipt / email HTML or text:\n${trimmed.slice(0, 40000)}`,
      },
    ],
  });

  const defaultLine: GroceryLineFulfillment =
    args.sourceType === "pasted_list" || args.sourceType === "email"
      ? "ordered"
      : "delivered";
  const candidates = mapGroceryItems(raw.items ?? [], defaultLine);
  const retailerCode: GroceryRetailerCode | null = detectWoolworthsContent(
    `${raw.retailer ?? ""}\n${trimmed}`,
  )
    ? WOOLWORTHS_RETAILER_CODE
    : "other";

  return {
    candidates,
    fulfillment: asFulfillment(raw.fulfillment),
    retailer: raw.retailer?.trim() || null,
    retailerCode,
    orderReference: raw.orderReference?.trim() || null,
    currency: "AUD",
    orderTotal: asMoney(raw.orderTotal),
    contentHash: contentHashFromRawInput({
      text: trimmed,
      orderReference: raw.orderReference,
    }),
    model: MODEL,
    parser: "openai_text",
  };
}

export async function extractGroceryFromImages(args: {
  apiKey: string;
  images: string[];
  sourceType: GrocerySourceType;
}): Promise<GroceryExtractResult> {
  if (args.images.length === 0) {
    throw new Error("Add at least one screenshot or photo.");
  }

  const raw = await callOpenAiJson({
    apiKey: args.apiKey,
    userContent: [
      {
        type: "text",
        text: `Source type: ${args.sourceType}. This may be a Woolworths Australia order email screenshot with columns Item description, Unit price, Qty, Price. Join wrapped product names. Extract every line. Never invent pack sizes or expiry.`,
      },
      ...args.images.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ],
  });

  const candidates = mapGroceryItems(raw.items ?? [], "delivered");
  return {
    candidates,
    fulfillment: asFulfillment(raw.fulfillment),
    retailer: raw.retailer?.trim() || null,
    retailerCode: detectWoolworthsContent(raw.retailer ?? "")
      ? WOOLWORTHS_RETAILER_CODE
      : "other",
    orderReference: raw.orderReference?.trim() || null,
    currency: "AUD",
    orderTotal: asMoney(raw.orderTotal),
    contentHash: contentHashFromRawInput({
      imageFingerprints: args.images.map(fingerprintDataUrl),
      orderReference: raw.orderReference,
    }),
    model: MODEL,
    parser: "openai_vision",
  };
}

export { MODEL as GROCERY_EXTRACT_MODEL };
