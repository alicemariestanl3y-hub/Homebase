"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductKind } from "@/lib/packaged-meals/types";

type LinkInventoryMealFormProps = {
  inventoryItemId: string;
  defaultName: string;
  onCancel: () => void;
};

const KIND_OPTIONS: Array<{ value: ProductKind; label: string }> = [
  { value: "recipe_base", label: "Recipe base" },
  { value: "meal_kit", label: "Meal kit" },
  { value: "cooking_sauce", label: "Cooking sauce" },
];

/**
 * Manual fallback when Smart Capture did not classify a packet product.
 * Links inventory → catalog (and optionally starts a Meals library recipe).
 */
export function LinkInventoryMealForm({
  inventoryItemId,
  defaultName,
  onCancel,
}: LinkInventoryMealFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [brand, setBrand] = useState("");
  const [packSize, setPackSize] = useState("");
  const [productKind, setProductKind] = useState<ProductKind>("recipe_base");
  const [createMeal, setCreateMeal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/packaged-meals/link-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryItemId,
          displayName: displayName.trim(),
          brand: brand.trim() || null,
          packSize: packSize.trim() || null,
          productKind,
          createRecipeTitle: createMeal
            ? displayName.replace(/recipe base/i, "").trim() || displayName
            : null,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        product?: { id: string };
        needsPacketVerify?: boolean;
        recipeId?: string | null;
      };
      if (!response.ok || !json.product) {
        setError(json.error || "Could not link this item.");
        return;
      }
      if (createMeal && (json.needsPacketVerify || !json.recipeId)) {
        router.push(`/meals/packet/new?productId=${json.product.id}`);
        router.refresh();
        return;
      }
      if (json.recipeId) {
        router.push(`/meals/${json.recipeId}`);
        router.refresh();
        return;
      }
      router.refresh();
      onCancel();
    });
  }

  return (
    <form className="item-inline-form" onSubmit={onSubmit}>
      <p className="hb-inline-lead">
        Link this stock line to a reusable recipe-base / meal-kit product.
      </p>
      <label className="auth-field">
        <span>Product name</span>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </label>
      <div className="add-item-form__row">
        <label className="auth-field">
          <span>Brand</span>
          <input
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="e.g. Mingle"
          />
        </label>
        <label className="auth-field">
          <span>Pack size</span>
          <input
            value={packSize}
            onChange={(event) => setPackSize(event.target.value)}
            placeholder="e.g. 30g"
          />
        </label>
      </div>
      <label className="auth-field">
        <span>Product type</span>
        <select
          value={productKind}
          onChange={(event) =>
            setProductKind(event.target.value as ProductKind)
          }
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="hb-check">
        <input
          type="checkbox"
          checked={createMeal}
          onChange={(event) => setCreateMeal(event.target.checked)}
        />
        Create a Meals library entry and verify packet next
      </label>
      {error ? <p className="auth-error">{error}</p> : null}
      <div className="inventory-row__actions">
        <button type="submit" className="row-action" disabled={pending}>
          {pending ? "Linking…" : "Link to meal"}
        </button>
        <button type="button" className="row-action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
