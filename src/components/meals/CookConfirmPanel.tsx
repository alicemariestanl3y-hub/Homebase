"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Recipe } from "@/lib/recipes/types";
import { formatQuantity } from "@/lib/inventory/units";
import { toIngredientKey } from "@/lib/ingredients/matching";

type CookConfirmPanelProps = {
  recipe: Recipe;
  inventory: InventoryItem[];
  packagedMealDefId?: string | null;
  packetsRequired?: number;
};

type DraftLine = {
  inventoryItemId: string;
  name: string;
  amount: number;
  unit: InventoryItem["unit"];
  role: "packet" | "additional";
  selected: boolean;
};

export function CookConfirmPanel({
  recipe,
  inventory,
  packagedMealDefId,
  packetsRequired = 1,
}: CookConfirmPanelProps) {
  const router = useRouter();
  const [packetsUsed, setPacketsUsed] = useState(String(packetsRequired));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initialLines = useMemo(() => {
    const lines: DraftLine[] = [];
    if (recipe.catalogProductId) {
      const packets = inventory.filter(
        (item) =>
          item.catalogProductId === recipe.catalogProductId ||
          toIngredientKey(item.name) ===
            toIngredientKey(
              inventory.find((row) => row.catalogProductId === recipe.catalogProductId)
                ?.name ?? recipe.title,
            ),
      );
      const packetItem =
        packets.find((item) => item.catalogProductId === recipe.catalogProductId) ??
        packets[0];
      if (packetItem) {
        lines.push({
          inventoryItemId: packetItem.id,
          name: packetItem.name,
          amount: packetsRequired,
          unit: packetItem.unit,
          role: "packet",
          selected: true,
        });
      }
    }

    for (const ingredient of recipe.ingredients) {
      if (ingredient.optional) continue;
      const key = ingredient.ingredientKey || toIngredientKey(ingredient.name);
      const match = inventory.find(
        (item) => toIngredientKey(item.name) === key,
      );
      if (!match) continue;
      lines.push({
        inventoryItemId: match.id,
        name: match.name,
        amount: Math.min(
          match.quantity,
          ingredient.quantity ?? match.quantity,
        ),
        unit: match.unit,
        role: "additional",
        selected: true,
      });
    }
    return lines;
  }, [inventory, packetsRequired, recipe]);

  const [lines, setLines] = useState(initialLines);

  function confirm() {
    setError(null);
    setMessage(null);
    const deductions = lines
      .filter((row) => row.selected && row.amount > 0)
      .map(({ inventoryItemId, name, amount, unit, role }) => ({
        inventoryItemId,
        name,
        amount,
        unit,
        role,
      }));

    startTransition(async () => {
      const response = await fetch("/api/packaged-meals/cook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: recipe.id,
          packagedMealDefId: packagedMealDefId ?? null,
          packetsUsed: Number(packetsUsed) || 1,
          servings: recipe.servings,
          deductions,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error || "Could not confirm cook.");
        return;
      }
      setMessage("Cooked meal recorded. Inventory updated.");
      router.refresh();
    });
  }

  if (recipe.recipeType === "traditional" && !recipe.catalogProductId) {
    return null;
  }

  return (
    <section className="cook-confirm" aria-labelledby="cook-heading">
      <h2 id="cook-heading" className="section-title">
        Mark as cooked
      </h2>
      <p className="hb-item-meta">
        Review deductions first. Packet contents already inside a kit are not
        listed separately. Duplicate confirms within two minutes are blocked.
      </p>

      <label className="auth-field" style={{ maxWidth: "8rem" }}>
        <span>Packets used</span>
        <input
          type="text"
          inputMode="decimal"
          value={packetsUsed}
          onChange={(event) => setPacketsUsed(event.target.value)}
        />
      </label>

      <ul className="hb-inventory-list">
        {lines.map((line, index) => (
          <li key={line.inventoryItemId} className="hb-item-card">
            <label className="hb-check" style={{ alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={line.selected}
                onChange={(event) =>
                  setLines((prev) =>
                    prev.map((row, i) =>
                      i === index
                        ? { ...row, selected: event.target.checked }
                        : row,
                    ),
                  )
                }
              />
              <span>
                <span className="hb-item-name">{line.name}</span>
                <span className="hb-item-meta">
                  Deduct {formatQuantity(line.amount, line.unit)} · {line.role}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {lines.length === 0 ? (
        <p className="hb-empty">
          No matching inventory rows found to deduct. Add the packet to inventory
          first.
        </p>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}
      {message ? <p className="auth-success">{message}</p> : null}

      <button
        type="button"
        className="hb-btn"
        disabled={pending || lines.every((row) => !row.selected)}
        onClick={confirm}
      >
        {pending ? "Saving…" : "Confirm cook & deduct"}
      </button>
    </section>
  );
}
