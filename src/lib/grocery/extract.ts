import { createHash } from "node:crypto";
import { INVENTORY_UNITS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { toIngredientKey } from "@/lib/ingredients/matching";
import { hashGroceryContent } from "./hash";
import type {
  GroceryCandidate,
  GroceryFulfillment,
  GroceryLineFulfillment,
  GrocerySourceType,
} from "./types";

const MODEL = "gpt-4o-mini";

type RawLine = {
  name?: string;
  brand?: string | null;
  packageSize?: string | null;
  quantity?: number | null;
  unit?: string | null;
  suggestedLocation?: string | null;
  lineFulfillment?: string | null;
  confidence?: string | null;
  needsReview?: boolean | null;
  notes?: string | null;
};

type RawExtract = {
  retailer?: string | null;
  orderReference?: string | null;
  fulfillment?: string | null;
  items?: RawLine[];
};

const SYSTEM_PROMPT = `You extract itemised grocery order / receipt lines for a household inventory app.

Rules:
- Only report products explicitly present in the provided text or images.
- Never invent products, quantities, brands, pack sizes or prices.
- If quantity/unit is unclear, set quantity to 1 and unit to "pieces", and mark needsReview true with confidence "low".
- unit must be one of: g, kg, ml, L, pieces, packets, bottles, cans.
- suggestedLocation must be one of: pantry, fridge, freezer.
- lineFulfillment: "delivered" when the receipt/order shows the item was received/paid; "ordered" when it is only on an order list / pending. If unclear, use "delivered" for receipts and "ordered" for order confirmations, and mark needsReview.
- fulfillment (order-level): ordered | delivered | mixed | unknown.
- Return JSON only: { "retailer": string|null, "orderReference": string|null, "fulfillment": "...", "items": [ ... ] }`;

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

export function mapGroceryItems(
  raw: RawLine[],
  defaultLineFulfillment: GroceryLineFulfillment = "delivered",
): GroceryCandidate[] {
  return raw
    .map((item, index) => {
      const name = (item.name ?? "").trim();
      if (!name) return null;
      const confidence = asConfidence(item.confidence);
      const quantity =
        typeof item.quantity === "number" && item.quantity > 0
          ? item.quantity
          : 1;
      const unit = asUnit(item.unit);
      const needsReview =
        item.needsReview === true ||
        confidence !== "high" ||
        !(typeof item.quantity === "number" && item.quantity > 0) ||
        !(item.unit && (INVENTORY_UNITS as readonly string[]).includes(item.unit));

      const candidate: GroceryCandidate = {
        id: `groc_${index}_${crypto.randomUUID().slice(0, 8)}`,
        name,
        brand: item.brand?.trim() || null,
        packageSize: item.packageSize?.trim() || null,
        quantity,
        unit,
        suggestedLocation: asLocation(item.suggestedLocation),
        lineFulfillment: asLineFulfillment(
          item.lineFulfillment,
          defaultLineFulfillment,
        ),
        confidence,
        needsReview,
        notes: item.notes?.trim() || null,
        ingredientKey: toIngredientKey(name),
        selected: true,
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
        `${item.name}|${item.quantity}|${item.unit}|${item.brand ?? ""}|${item.packageSize ?? ""}`,
    )
    .sort();
  return hashGroceryContent([...extra, ...lines]);
}

export function contentHashFromRawInput(input: {
  text?: string;
  imageFingerprints?: string[];
}): string {
  return hashGroceryContent([
    input.text ?? "",
    ...(input.imageFingerprints ?? []),
  ]);
}

export function fingerprintDataUrl(dataUrl: string): string {
  return createHash("sha256").update(dataUrl.slice(0, 5000)).digest("hex");
}

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
}): Promise<{
  candidates: GroceryCandidate[];
  fulfillment: GroceryFulfillment;
  retailer: string | null;
  orderReference: string | null;
  contentHash: string;
  model: string;
}> {
  const trimmed = args.text.trim();
  if (!trimmed) throw new Error("Paste an itemised grocery list first.");

  const raw = await callOpenAiJson({
    apiKey: args.apiKey,
    userContent: [
      {
        type: "text",
        text: `Source type: ${args.sourceType}\n\nGrocery list / receipt text:\n${trimmed.slice(0, 20000)}`,
      },
    ],
  });

  const defaultLine: GroceryLineFulfillment =
    args.sourceType === "pasted_list" || args.sourceType === "email"
      ? "ordered"
      : "delivered";
  const candidates = mapGroceryItems(raw.items ?? [], defaultLine);
  const fulfillment = asFulfillment(raw.fulfillment);
  const contentHash = contentHashFromRawInput({
    text: trimmed,
  });

  return {
    candidates,
    fulfillment,
    retailer: raw.retailer?.trim() || null,
    orderReference: raw.orderReference?.trim() || null,
    contentHash,
    model: MODEL,
  };
}

export async function extractGroceryFromImages(args: {
  apiKey: string;
  images: string[];
  sourceType: GrocerySourceType;
}): Promise<{
  candidates: GroceryCandidate[];
  fulfillment: GroceryFulfillment;
  retailer: string | null;
  orderReference: string | null;
  contentHash: string;
  model: string;
}> {
  if (args.images.length === 0) {
    throw new Error("Add at least one screenshot or photo.");
  }

  const raw = await callOpenAiJson({
    apiKey: args.apiKey,
    userContent: [
      {
        type: "text",
        text: `Source type: ${args.sourceType}. Extract every line item visible on these grocery order / receipt images.`,
      },
      ...args.images.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ],
  });

  const candidates = mapGroceryItems(raw.items ?? [], "delivered");
  const contentHash = contentHashFromRawInput({
    imageFingerprints: args.images.map(fingerprintDataUrl),
  });

  return {
    candidates,
    fulfillment: asFulfillment(raw.fulfillment),
    retailer: raw.retailer?.trim() || null,
    orderReference: raw.orderReference?.trim() || null,
    contentHash,
    model: MODEL,
  };
}

export { MODEL as GROCERY_EXTRACT_MODEL };
