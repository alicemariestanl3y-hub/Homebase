"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  consumeInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
  type MutationState,
} from "@/app/actions/inventory";
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

const initialState: MutationState = { error: null, ok: false };

export function InventoryItemRow({
  item,
  index,
  locationType,
}: InventoryItemRowProps) {
  const [mode, setMode] = useState<"view" | "edit" | "use">("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [updateState, updateAction, updatePending] = useActionState(
    updateInventoryItem,
    initialState,
  );
  const [consumeState, consumeAction, consumePending] = useActionState(
    consumeInventoryItem,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteInventoryItem,
    initialState,
  );

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

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
            <form action={deleteAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <button
                type="submit"
                className="danger"
                role="menuitem"
                disabled={deletePending}
              >
                {deletePending ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {mode === "use" ? (
        <form className="item-inline-form" action={consumeAction}>
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
          {consumeState.error ? (
            <p className="auth-error">{consumeState.error}</p>
          ) : null}
          <div className="inventory-row__actions">
            <button type="submit" className="row-action" disabled={consumePending}>
              {consumePending ? "Saving…" : "Confirm use"}
            </button>
            <button type="button" className="row-action" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "edit" ? (
        <form className="item-inline-form" action={updateAction}>
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
            <input name="expiresOn" type="date" defaultValue={item.expiresOn ?? ""} />
          </label>
          <label className="auth-field">
            <span>Notes (optional)</span>
            <input name="notes" type="text" defaultValue={item.notes ?? ""} />
          </label>
          {updateState.error ? (
            <p className="auth-error">{updateState.error}</p>
          ) : null}
          <div className="inventory-row__actions">
            <button type="submit" className="row-action" disabled={updatePending}>
              {updatePending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="row-action" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {deleteState.error ? <p className="auth-error">{deleteState.error}</p> : null}
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
