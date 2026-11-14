import type { InventoryUnit, UnitDimension } from "./types";

export const INVENTORY_UNITS: readonly InventoryUnit[] = [
  "g",
  "kg",
  "ml",
  "L",
  "pieces",
  "packets",
  "bottles",
  "cans",
] as const;

export const UNIT_LABELS: Record<InventoryUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  L: "L",
  pieces: "pieces",
  packets: "packets",
  bottles: "bottles",
  cans: "cans",
};

export function unitDimension(unit: InventoryUnit): UnitDimension {
  switch (unit) {
    case "g":
    case "kg":
      return "mass";
    case "ml":
    case "L":
      return "volume";
    case "pieces":
      return "count";
    case "packets":
    case "bottles":
    case "cans":
      return "container";
  }
}

/** Base factor within a convertible family (mass → grams, volume → ml). */
function toBase(quantity: number, unit: InventoryUnit): number | null {
  switch (unit) {
    case "g":
      return quantity;
    case "kg":
      return quantity * 1000;
    case "ml":
      return quantity;
    case "L":
      return quantity * 1000;
    default:
      // pieces and containers are not convertible without more metadata
      return null;
  }
}

/**
 * Convert between compatible units (g↔kg, ml↔L).
 * Returns null when conversion is not defined (e.g. packets → g).
 */
export function convertQuantity(
  quantity: number,
  from: InventoryUnit,
  to: InventoryUnit,
): number | null {
  if (from === to) return quantity;
  if (unitDimension(from) !== unitDimension(to)) return null;
  if (unitDimension(from) === "container" || unitDimension(from) === "count") {
    return null;
  }

  const base = toBase(quantity, from);
  if (base === null) return null;

  switch (to) {
    case "g":
    case "ml":
      return base;
    case "kg":
    case "L":
      return base / 1000;
    default:
      return null;
  }
}

export function formatQuantity(quantity: number, unit: InventoryUnit): string {
  const display =
    Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace(/\.0$/, "");
  return `${display} ${UNIT_LABELS[unit]}`;
}
