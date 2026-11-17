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
  formatQuantity,
  INVENTORY_UNITS,
  UNIT_LABELS,
} from "@/lib/inventory/units";
import type { InventoryItemView, LocationType } from "@/lib/inventory/types";

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
  const [mode, setMode] = useState<"view" | "edit" | "use">("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

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

  return (
    <li
      className="hb-item-row"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className={`hb-item-thumb hb-item-thumb--${locationType}`}>
        {LOCATION_LABELS[locationType].slice(0, 3)}
      </div>

      <div>
        <h3 className="hb-item-name">{item.name}</h3>
        <div className="hb-item-meta">
          {item.expiryLabel ? (
            <span className={`hb-item-meta--${item.urgency}`}>
              {formatExpiryShort(item.expiryLabel, item.urgency)}
            </span>
          ) : (
            <span>No expiry set</span>
          )}
          <span className="hb-pill">{LOCATION_LABELS[locationType]}</span>
        </div>
      </div>

      <div className="hb-item-actions" ref={menuRef}>
        <p className="hb-item-qty">
          {formatQuantity(item.quantity, item.unit)}
        </p>
        <button
          type="button"
          className="hb-kebab"
          aria-label={`Actions for ${item.name}`}
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
              Use
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMode("edit");
                setMenuOpen(false);
              }}
            >
              Edit
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                runMutation(deleteInventoryItemClient, formData);
                setMenuOpen(false);
              }}
            >
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                className="danger"
                role="menuitem"
                disabled={pending}
              >
                {pending ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {mode === "use" ? (
        <form
          className="item-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            runMutation(consumeInventoryItemClient, formData, () =>
              setMode("view"),
            );
          }}
        >
          <input type="hidden" name="itemId" value={item.id} />
          <label className="auth-field">
            <span>Amount used</span>
            <input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.1"
              step="any"
              max={item.quantity}
              required
              defaultValue={Math.min(1, item.quantity)}
            />
          </label>
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
      ) : null}

      {mode === "edit" ? (
        <form
          className="item-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            runMutation(updateInventoryItemClient, formData, () =>
              setMode("view"),
            );
          }}
        >
          <input type="hidden" name="itemId" value={item.id} />
          <label className="auth-field">
            <span>Name</span>
            <input name="name" type="text" required defaultValue={item.name} />
          </label>
          <div className="add-item-form__row">
            <label className="auth-field">
              <span>Qty</span>
              <input
                name="quantity"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="any"
                required
                defaultValue={item.quantity}
              />
            </label>
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
            <span>Notes (optional)</span>
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

      {mode === "view" && error ? (
        <p className="auth-error">{error}</p>
      ) : null}
    </li>
  );
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
