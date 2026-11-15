"use client";

import { useActionState, useState } from "react";
import {
  consumeInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
  type MutationState,
} from "@/app/actions/inventory";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { formatQuantity, INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
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

  return (
    <li
      className={`inventory-row inventory-row--${item.urgency}`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="inventory-row__main">
        <h3 className="inventory-row__name">{item.name}</h3>
        <p className="inventory-row__qty">
          {formatQuantity(item.quantity, item.unit)}
        </p>
      </div>
      {item.expiryLabel ? (
        <p
          className={`inventory-row__expiry inventory-row__expiry--${item.urgency}`}
        >
          {item.expiryLabel}
        </p>
      ) : null}
      {item.notes ? <p className="inventory-row__notes">{item.notes}</p> : null}

      {mode === "view" ? (
        <div className="inventory-row__actions">
          <button
            type="button"
            className="row-action"
            onClick={() => setMode("use")}
          >
            Use
          </button>
          <button
            type="button"
            className="row-action"
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <form action={deleteAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              className="row-action row-action--danger"
              disabled={deletePending}
            >
              {deletePending ? "Removing…" : "Remove"}
            </button>
          </form>
        </div>
      ) : null}

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
          <label className="auth-field">
            <span>Note (optional)</span>
            <input name="note" type="text" placeholder="Dinner" />
          </label>
          {consumeState.error ? (
            <p className="auth-error">{consumeState.error}</p>
          ) : null}
          <div className="inventory-row__actions">
            <button
              type="submit"
              className="row-action row-action--primary"
              disabled={consumePending}
            >
              {consumePending ? "Saving…" : "Confirm use"}
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
            <input
              name="expiresOn"
              type="date"
              defaultValue={item.expiresOn ?? ""}
            />
          </label>
          <label className="auth-field">
            <span>Notes (optional)</span>
            <input
              name="notes"
              type="text"
              defaultValue={item.notes ?? ""}
            />
          </label>
          {updateState.error ? (
            <p className="auth-error">{updateState.error}</p>
          ) : null}
          <div className="inventory-row__actions">
            <button
              type="submit"
              className="row-action row-action--primary"
              disabled={updatePending}
            >
              {updatePending ? "Saving…" : "Save"}
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

      {deleteState.error ? (
        <p className="auth-error">{deleteState.error}</p>
      ) : null}
    </li>
  );
}
