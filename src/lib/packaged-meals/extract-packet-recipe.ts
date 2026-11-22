import type { InventoryUnit } from "@/lib/inventory/types";
import { INVENTORY_UNITS } from "@/lib/inventory/units";

const MODEL = "gpt-4o-mini";

export type PacketRecipeDraft = {
  title: string | null;
  servings: number | null;
  packetsRequired: number;
  instructions: string | null;
  included: Array<{
    name: string;
    quantity: number | null;
    unit: InventoryUnit | null;
  }>;
  additionalIngredients: Array<{
    name: string;
    quantity: number | null;
    unit: InventoryUnit | null;
    optional?: boolean;
  }>;
  source: "packet_photo" | "unavailable";
  notes: string | null;
};

/**
 * Read recipe details ONLY from what is printed on the packet photo.
 * Never invents ingredients, quantities, or steps. Returns unavailable when
 * the packet text is not readable.
 */
export async function extractPacketRecipeFromImages(params: {
  apiKey: string;
  dataUrls: string[];
  productName: string;
  brand?: string | null;
}): Promise<PacketRecipeDraft> {
  const empty: PacketRecipeDraft = {
    title: params.productName,
    servings: null,
    packetsRequired: 1,
    instructions: null,
    included: [{ name: params.productName, quantity: 1, unit: "packets" }],
    additionalIngredients: [],
    source: "unavailable",
    notes: "Packet instructions were not readable in the photo.",
  };

  if (params.dataUrls.length === 0) return empty;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [
    {
      type: "text",
      text: `This photo is of a packaged recipe base / meal kit / cooking sauce: "${params.brand ?? ""} ${params.productName}".

Extract ONLY text that is clearly printed on the packaging:
- cooking instructions / method
- "you will need" / additional ingredients with quantities when printed
- servings if printed
- ingredients contained in the packet if listed

Rules:
- NEVER invent ingredients, quantities, or steps.
- If a field is not clearly readable, use null / empty arrays.
- Return JSON: { "title", "servings", "packetsRequired", "instructions", "included": [{name, quantity, unit}], "additionalIngredients": [{name, quantity, unit, optional}], "readable": boolean }`,
    },
  ];

  for (const url of params.dataUrls) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "high" },
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
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract printed packet recipe text only. Never invent missing details.",
        },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    return {
      ...empty,
      notes: `Could not read packet (${response.status}). Paste instructions manually.`,
    };
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) return empty;

  try {
    const parsed = JSON.parse(text) as {
      title?: string | null;
      servings?: number | null;
      packetsRequired?: number | null;
      instructions?: string | null;
      included?: Array<{
        name?: string;
        quantity?: number | null;
        unit?: string | null;
      }>;
      additionalIngredients?: Array<{
        name?: string;
        quantity?: number | null;
        unit?: string | null;
        optional?: boolean;
      }>;
      readable?: boolean;
    };

    const instructions = parsed.instructions?.trim() || null;
    const additional = (parsed.additionalIngredients ?? [])
      .map((row) => ({
        name: (row.name ?? "").trim(),
        quantity:
          typeof row.quantity === "number" && row.quantity > 0
            ? row.quantity
            : null,
        unit: asUnit(row.unit),
        optional: Boolean(row.optional),
      }))
      .filter((row) => row.name);

    const included = (parsed.included ?? [])
      .map((row) => ({
        name: (row.name ?? "").trim(),
        quantity:
          typeof row.quantity === "number" && row.quantity > 0
            ? row.quantity
            : null,
        unit: asUnit(row.unit),
      }))
      .filter((row) => row.name);

    if (!instructions && additional.length === 0) {
      return empty;
    }

    return {
      title: parsed.title?.trim() || params.productName,
      servings:
        typeof parsed.servings === "number" && parsed.servings > 0
          ? parsed.servings
          : null,
      packetsRequired:
        typeof parsed.packetsRequired === "number" &&
        parsed.packetsRequired > 0
          ? parsed.packetsRequired
          : 1,
      instructions,
      included:
        included.length > 0
          ? included
          : [{ name: params.productName, quantity: 1, unit: "packets" }],
      additionalIngredients: additional,
      source: "packet_photo",
      notes: parsed.readable === false
        ? "Some packet text was unclear — please verify before saving."
        : "Extracted from packet photo — please confirm.",
    };
  } catch {
    return empty;
  }
}

function asUnit(value: string | null | undefined): InventoryUnit | null {
  if (value && (INVENTORY_UNITS as readonly string[]).includes(value)) {
    return value as InventoryUnit;
  }
  return null;
}
