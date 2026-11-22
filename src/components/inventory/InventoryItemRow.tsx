"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  consumeInventoryItemClient,
  deleteInventoryItemClient,
  updateInventoryItemClient,
} from "@/lib/inventory/client-mutations";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import {
  displayProductName,
  originalRetailerName,
  rememberUnitForProduct,
} from "@/lib/inventory/product-names";
import {
  formatQuantity,
  INVENTORY_UNITS,
  UNIT_LABELS,
} from "@/lib/inventory/units";
import type { InventoryItemView, LocationType } from "@/lib/inventory/types";
import { LinkInventoryMealForm } from "./LinkInventoryMealForm";
import { QuantityInput } from "./QuantityInput";

type InventoryItemRowProps = {
  item: InventoryItemView;
  index: number;
  locationType: LocationType;
};

export function InventoryItemRow({
  item,
  index,
  locationType,
}: InventoryItemRowProps) {
  const router = useRouter();
  const [mode, setMode] = useState<
    "view" | "edit" | "use" | "remove" | "link"
  >("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [qtyDraft, setQtyDraft] = useState(item.quantity);

  useEffect(() => {
    setQtyDraft(item.quantity);
  }, [item.quantity]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const title = displayProductName(item.name);
  const retailerOriginal = originalRetailerName(item.notes);

  function runMutation(
    action: (formData: FormData) => Promise<{ error: string | null; ok: boolean }>,
    formData: FormData,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function bumpQuantity(delta: number) {
    const next = Math.round((qtyDraft + delta) * 100) / 100;
    if (next <= 0) {
      setMode("remove");
      return;
    }
    const formData = new FormData();
    formData.set("itemId", item.id);
    formData.set("name", item.name);
    formData.set("quantity", String(next));
    formData.set("unit", item.unit);
    formData.set("locationType", locationType);
    if (item.expiresOn) formData.set("expiresOn", item.expiresOn);
    if (item.notes) formData.set("notes", item.notes);
    runMutation(updateInventoryItemClient, formData, () => setQtyDraft(next));
  }

  function markUsed(amount: number) {
    const formData = new FormData();
    formData.set("itemId", item.id);
    formData.set("amount", String(amount));
    runMutation(consumeInventoryItemClient, formData, () => setMode("view"));
  }

  return (
    <li
      className="hb-item-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="hb-item-card__main">
        <div className={`hb-item-thumb hb-item-thumb--${locationType}`}>
          {LOCATION_LABELS[locationType].slice(0, 3)}
        </div>

        <div className="hb-item-card__body">
          <h3 className="hb-item-name">{title}</h3>
          <div className="hb-item-meta">
            <span className="hb-item-qty-inline">
              {formatQuantity(item.quantity, item.unit)}
            </span>
            <span className="hb-pill">{LOCATION_LABELS[locationType]}</span>
            {item.expiryLabel ? (
              <span className={`hb-item-meta--${item.urgency}`}>
                {formatExpiryShort(item.expiryLabel, item.urgency)}
              </span>
            ) : null}
          </div>
          {retailerOriginal &&
          displayProductName(retailerOriginal) !== title ? (
            <p className="hb-item-original">{retailerOriginal}</p>
          ) : null}
        </div>

        <div className="hb-item-actions" ref={menuRef}>
          <div className="hb-qty-stepper">
            <button
              type="button"
              className="hb-qty-stepper__btn"
              aria-label={`Decrease ${title}`}
              disabled={pending}
              onClick={() => bumpQuantity(-stepForUnit(item.unit, item.quantity))}
            >
              −
            </button>
            <button
              type="button"
              className="hb-qty-stepper__btn"
              aria-label={`Increase ${title}`}
              disabled={pending}
              onClick={() => bumpQuantity(stepForUnit(item.unit, item.quantity))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="hb-kebab"
            aria-label={`More actions for ${title}`}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            ···
          </button>
          {menuOpen ? (
            <div className="hb-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMode("use");
                  setMenuOpen(false);
                }}
              >
                Mark used
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMode("edit");
                  setMenuOpen(false);
                }}
              >
                Edit details
              </button>
              {!item.catalogProductId ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMode("link");
                    setMenuOpen(false);
                  }}
                >
                  Link to recipe meal…
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(
                      `/meals/packet/new?productId=${item.catalogProductId}`,
                    );
                  }}
                >
                  Verify / update packet meal
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMode("remove");
                  setMenuOpen(false);
                }}
              >
                Remove…
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {mode === "use" ? (
        <div className="item-inline-form">
          <p className="hb-inline-lead">How much did you use?</p>
          <div className="hb-quick-use">
            <button
              type="button"
              className="hb-btn hb-btn--ghost"
              disabled={pending}
              onClick={() => markUsed(Math.min(1, item.quantity))}
            >
              Use 1
            </button>
            <button
              type="button"
              className="hb-btn hb-btn--ghost"
              disabled={pending}
              onClick={() => markUsed(item.quantity)}
            >
              Use all
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const amount = Number(formData.get("amount"));
              if (!Number.isFinite(amount) || amount <= 0) {
                setError("Enter how much you used.");
                return;
              }
              markUsed(amount);
            }}
          >
            <QuantityInput
              name="amount"
              label={`Custom amount (${UNIT_LABELS[item.unit]})`}
              initialValue={null}
              max={item.quantity}
              required
            />
            {error ? <p className="auth-error">{error}</p> : null}
            <div className="inventory-row__actions">
              <button type="submit" className="row-action" disabled={pending}>
                {pending ? "Saving…" : "Confirm use"}
              </button>
              <button
                type="button"
                className="row-action"
                onClick={() => setMode("view")}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {mode === "edit" ? (
        <form
          className="item-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const nextName = String(formData.get("name") ?? "").trim();
            const nextUnit = String(formData.get("unit") ?? "");
            runMutation(updateInventoryItemClient, formData, () => {
              if (nextName && nextUnit) {
                rememberUnitForProduct(nextName, nextUnit);
              }
              setMode("view");
            });
          }}
        >
          <input type="hidden" name="itemId" value={item.id} />
          <label className="auth-field">
            <span>Name</span>
            <input name="name" type="text" required defaultValue={item.name} />
          </label>
          <div className="add-item-form__row">
            <QuantityInput
              name="quantity"
              label="Qty"
              initialValue={item.quantity}
              required
            />
            <label className="auth-field">
              <span>Unit</span>
              <select name="unit" required defaultValue={item.unit}>
                {INVENTORY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="auth-field">
            <span>Location</span>
            <select name="locationType" required defaultValue={locationType}>
              {LOCATION_ORDER.map((location) => (
                <option key={location} value={location}>
                  {LOCATION_LABELS[location]}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-field">
            <span>Expiry (optional)</span>
            <input
              name="expiresOn"
              type="date"
              defaultValue={item.expiresOn ?? ""}
            />
          </label>
          <label className="auth-field">
            <span>Notes (optional — keeps retailer text for matching)</span>
            <input name="notes" type="text" defaultValue={item.notes ?? ""} />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="inventory-row__actions">
            <button type="submit" className="row-action" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="row-action"
              onClick={() => setMode("view")}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "link" ? (
        <LinkInventoryMealForm
          inventoryItemId={item.id}
          defaultName={item.name}
          onCancel={() => setMode("view")}
        />
      ) : null}

      {mode === "remove" ? (
        <div className="item-inline-form">
          <p className="hb-inline-lead">
            Remove <strong>{title}</strong> from inventory?
          </p>
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="inventory-row__actions">
            <button
              type="button"
              className="row-action danger"
              disabled={pending}
              onClick={() => {
                const formData = new FormData();
                formData.set("itemId", item.id);
                runMutation(deleteInventoryItemClient, formData, () =>
                  setMode("view"),
                );
              }}
            >
              {pending ? "Removing…" : "Yes, remove"}
            </button>
            <button
              type="button"
              className="row-action"
              onClick={() => setMode("view")}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mode === "view" && error ? (
        <p className="auth-error">{error}</p>
      ) : null}
    </li>
  );
}

function stepForUnit(unit: InventoryItemView["unit"], quantity: number): number {
  if (unit === "g" || unit === "ml") {
    if (quantity >= 500) return 50;
    if (quantity >= 100) return 25;
    return 10;
  }
  if (unit === "kg" || unit === "L") return 0.1;
  return 1;
}

function formatExpiryShort(
  label: string,
  urgency: InventoryItemView["urgency"],
): string {
  if (urgency === "expired") return label;
  if (urgency === "soon") return label;
  if (label.startsWith("Expires ")) return label.replace("Expires ", "Good until ");
  return label;
}
