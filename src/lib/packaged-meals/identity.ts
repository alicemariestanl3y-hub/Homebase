import { toIngredientKey } from "@/lib/ingredients/matching";
import { displayProductName } from "@/lib/inventory/product-names";

/** Stable identity for reuse across repurchase of the same packet. */
export function productIdentityKey(input: {
  brand?: string | null;
  displayName: string;
  variant?: string | null;
  packSize?: string | null;
  originalName?: string | null;
}): string {
  const brand = (input.brand ?? "").trim().toLowerCase();
  const name = displayProductName(
    input.displayName || input.originalName || "",
  )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const variant = (input.variant ?? "").trim().toLowerCase();
  const pack = (input.packSize ?? "").trim().toLowerCase();
  return [brand, name, variant, pack].filter(Boolean).join("|");
}

export function catalogIngredientKey(input: {
  brand?: string | null;
  displayName: string;
  variant?: string | null;
}): string {
  return toIngredientKey(
    [input.brand, input.displayName, input.variant].filter(Boolean).join(" "),
  );
}

export function splitBrandAndName(rawName: string): {
  brand: string | null;
  displayName: string;
  variant: string | null;
  packSize: string | null;
} {
  const cleaned = rawName.replace(/\s*\n+\s*/g, " ").trim();
  const packMatch = cleaned.match(
    /\b(\d+(?:\.\d+)?\s?(?:g|kg|ml|l|pk|pack|packs))\b/i,
  );
  const packSize = packMatch?.[1] ?? null;

  let brand: string | null = null;
  let rest = cleaned;
  const brandMatch = cleaned.match(
    /^(mingle|passage foods|passage|patak'?s|maggi|masterfoods|old el paso|mission|always fresh|woolworths|macro)\b\s+/i,
  );
  if (brandMatch) {
    brand = brandMatch[1];
    rest = cleaned.slice(brandMatch[0].length).trim();
  }

  // Flavour / variant often after em dash or " - "
  let variant: string | null = null;
  const variantSplit = rest.split(/\s+[–—-]\s+/);
  if (variantSplit.length > 1) {
    rest = variantSplit[0]!.trim();
    variant = variantSplit.slice(1).join(" - ").trim();
  }

  return {
    brand,
    displayName: displayProductName(rest || cleaned),
    variant,
    packSize,
  };
}
