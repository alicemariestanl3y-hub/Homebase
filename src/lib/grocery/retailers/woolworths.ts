/**
 * Woolworths Australia order-email parser.
 *
 * Recognises itemised HTML tables with columns:
 * Item description | Unit price | Qty | Price
 *
 * Multi-line descriptions (e.g. name + pack size on separate lines / <br>)
 * are joined. Pack sizes and expiry are never invented.
 */

import { toIngredientKey } from "@/lib/ingredients/matching";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import type { GroceryCandidate, GroceryFulfillment } from "../types";

export const WOOLWORTHS_RETAILER_CODE = "woolworths_au";

const NON_FOOD_PATTERNS = [
  /\b(laundry|detergent|fabric softener|bleach)\b/i,
  /\b(dish(washing)?|dishwasher)\b/i,
  /\b(toilet|tissue|paper towel|kitchen towel)\b/i,
  /\b(bin liner|garbage bag|glad wrap|cling wrap|alfoil|foil)\b/i,
  /\b(shampoo|conditioner|deodorant|toothpaste|toothbrush)\b/i,
  /\b(nappy|nappies|wipe|wipes)\b/i,
  /\b(magazine|newspaper|gift card|voucher)\b/i,
  /\b(pet food|cat litter|dog food)\b/i,
  /\b(battery|batteries|light ?bulb|charger)\b/i,
  /\b(cleaning|disinfectant|spray|sponge|scourer)\b/i,
  /\b(plastic bag|reusable bag|green bag)\b/i,
];

const FRIDGE_PATTERNS = [
  /\b(milk|cream|yoghurt|yogurt|butter|cheese|eggs?)\b/i,
  /\b(juice|fresh pasta|tofu|hummus|dip)\b/i,
  /\b(chicken|beef|pork|lamb|mince|sausage|bacon|ham)\b/i,
  /\b(salad|lettuce|spinach|herbs)\b/i,
];

const FREEZER_PATTERNS = [
  /\b(frozen|ice cream|ice-cream|hash brown)\b/i,
  /\b(peas|corn|berries|chips|pizza)\b/i,
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function collapseSpaces(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseQty(value: string): number | null {
  const match = value.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const qty = Number(match[1]);
  return qty > 0 ? qty : null;
}

/** Extract pack size from description only when explicitly present. */
export function extractPackSizeFromDescription(
  description: string,
): string | null {
  const match = description.match(
    /\b(\d+([.,]\d+)?\s?(g|kg|ml|l|L|pack|pk|ea))\b/i,
  );
  return match ? match[1].replace(/\s+/g, "") : null;
}

export function suggestLocationFromName(name: string): LocationType {
  if (FREEZER_PATTERNS.some((pattern) => pattern.test(name))) return "freezer";
  if (FRIDGE_PATTERNS.some((pattern) => pattern.test(name))) return "fridge";
  return "pantry";
}

export function isLikelyNonFood(name: string): boolean {
  return NON_FOOD_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Standardise Woolworths marketing names for recipe matching while
 * preserving the original line for inventory display.
 */
export function standardizeWoolworthsName(original: string): string {
  let name = original;
  // Drop leading brand house names when followed by a product description.
  name = name.replace(
    /^(woolworths|macro|essentials|gold|odp|own brand)\s+/i,
    "",
  );
  // Prefer the first line when description wrapped with pack info below.
  const firstLine = name.split("\n")[0]?.trim() || name;
  return collapseSpaces(firstLine);
}

function guessUnit(
  description: string,
  packSize: string | null,
): InventoryUnit {
  const haystack = `${description} ${packSize ?? ""}`.toLowerCase();
  if (/\bml\b/.test(haystack)) return "ml";
  if (/\b\d+(\.\d+)?\s?l\b/.test(haystack) || /\bl\b/.test(haystack)) {
    return "L";
  }
  if (/\bg\b/.test(haystack)) return "g";
  if (/\bkg\b/.test(haystack)) return "kg";
  if (/\b(can|cans)\b/.test(haystack)) return "cans";
  if (/\b(bottle|bottles)\b/.test(haystack)) return "bottles";
  if (/\b(packet|packets|pack|pk)\b/.test(haystack)) return "packets";
  return "pieces";
}

export function detectWoolworthsContent(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("woolworths") ||
    lower.includes("woolies") ||
    lower.includes("woolworths.com.au") ||
    (lower.includes("item description") &&
      lower.includes("unit price") &&
      lower.includes("qty"))
  );
}

export function extractOrderReference(content: string): string | null {
  const patterns = [
    /order\s*(number|#|no\.?)[:\s]*([A-Z0-9-]+)/i,
    /receipt\s*(number|#|no\.?)[:\s]*([A-Z0-9-]+)/i,
    /\bW\d{6,}\b/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (!match) continue;
    return (match[2] || match[0]).trim();
  }
  return null;
}

export function detectFulfillment(content: string): GroceryFulfillment {
  const lower = content.toLowerCase();
  // Prefer pending/confirmed signals first so "thanks for shopping" alone
  // does not mark an unpicked order as delivered.
  if (
    lower.includes("order confirmed") ||
    lower.includes("we're preparing") ||
    lower.includes("we are preparing") ||
    lower.includes("picking your order") ||
    lower.includes("being picked")
  ) {
    return "ordered";
  }
  if (
    lower.includes("has been delivered") ||
    lower.includes("delivery complete") ||
    lower.includes("delivered to") ||
    /\bdelivered\b/.test(lower)
  ) {
    return "delivered";
  }
  return "unknown";
}

type ParsedRow = {
  descriptionHtml: string;
  unitPrice: string;
  qty: string;
  price: string;
};

function extractTableRows(html: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html))) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      cells.push(cellMatch[1]);
    }
    if (cells.length < 4) continue;
    const header = stripTags(cells.join(" ")).toLowerCase();
    if (
      header.includes("item description") ||
      (header.includes("unit price") && header.includes("qty"))
    ) {
      continue;
    }
    rows.push({
      descriptionHtml: cells[0],
      unitPrice: stripTags(cells[1]),
      qty: stripTags(cells[2]),
      price: stripTags(cells[3]),
    });
  }
  return rows;
}

/** Plain-text fallback when the paste lost HTML but kept column layout. */
function extractTextRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // "Product name ... $3.00 2 $6.00" or tab-separated
    const moneyMatches = [...line.matchAll(/\$?\d+\.\d{2}/g)];
    if (moneyMatches.length >= 2) {
      const qtyMatch = line.match(/\s(\d+(?:\.\d+)?)\s+(?=\$?\d+\.\d{2}\s*$)/);
      const name = line
        .replace(/\$?\d+\.\d{2}/g, " ")
        .replace(/\s\d+(?:\.\d+)?\s*$/, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!name || /item description/i.test(name)) continue;
      rows.push({
        descriptionHtml: name,
        unitPrice: moneyMatches[0][0],
        qty: qtyMatch?.[1] ?? "1",
        price: moneyMatches[moneyMatches.length - 1][0],
      });
      continue;
    }

    // Wrapped description: name on this line, money on the next.
    if (
      i + 1 < lines.length &&
      /\$?\d+\.\d{2}/.test(lines[i + 1]) &&
      !/\$?\d+\.\d{2}/.test(line)
    ) {
      const next = lines[i + 1];
      const moneyMatches = [...next.matchAll(/\$?\d+\.\d{2}/g)];
      if (moneyMatches.length >= 2) {
        const qtyMatch = next.match(
          /\s(\d+(?:\.\d+)?)\s+(?=\$?\d+\.\d{2}\s*$)/,
        );
        rows.push({
          descriptionHtml: line,
          unitPrice: moneyMatches[0][0],
          qty: qtyMatch?.[1] ?? "1",
          price: moneyMatches[moneyMatches.length - 1][0],
        });
        i += 1;
      }
    }
  }
  return rows;
}

export function parseWoolworthsEmail(content: string): {
  candidates: GroceryCandidate[];
  retailer: string;
  retailerCode: string;
  orderReference: string | null;
  fulfillment: GroceryFulfillment;
  currency: "AUD";
  orderTotal: number | null;
} {
  const rows =
    content.includes("<") && content.includes("tr")
      ? extractTableRows(content)
      : extractTextRows(content);

  const candidates: GroceryCandidate[] = rows.map((row, index) => {
    const rawDescription = collapseSpaces(stripTags(row.descriptionHtml));
    // Keep newlines from <br> as spaces already collapsed; rebuild multi-line
    // pack hint by preferring the joined description.
    const originalName = rawDescription;
    const standardizedName = standardizeWoolworthsName(originalName);
    const packSize = extractPackSizeFromDescription(originalName);
    const quantity = parseQty(row.qty) ?? 1;
    const unitPrice = parseMoney(row.unitPrice);
    const linePrice = parseMoney(row.price);
    const nonFood = isLikelyNonFood(originalName);
    const unit = guessUnit(originalName, packSize);

    return {
      id: `ww_${index}_${crypto.randomUUID().slice(0, 8)}`,
      name: originalName,
      originalName,
      standardizedName,
      brand: /^woolworths\b/i.test(originalName) ? "Woolworths" : null,
      packageSize: packSize,
      quantity,
      unit,
      unitPrice,
      linePrice,
      currency: "AUD",
      suggestedLocation: suggestLocationFromName(originalName),
      lineFulfillment: "delivered",
      isFood: !nonFood,
      wasSubstituted: /substitut/i.test(originalName),
      substitutionNote: null,
      confidence: unitPrice != null && linePrice != null ? "high" : "medium",
      needsReview: nonFood || packSize == null,
      notes: null,
      ingredientKey: toIngredientKey(standardizedName),
      selected: !nonFood,
      mergeWithItemId: null,
    };
  });

  const orderTotal = candidates.reduce((sum, item) => {
    return sum + (item.linePrice ?? 0);
  }, 0);

  return {
    candidates,
    retailer: "Woolworths",
    retailerCode: WOOLWORTHS_RETAILER_CODE,
    orderReference: extractOrderReference(content),
    fulfillment: detectFulfillment(content),
    currency: "AUD",
    orderTotal: orderTotal > 0 ? Math.round(orderTotal * 100) / 100 : null,
  };
}
