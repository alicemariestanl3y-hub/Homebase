"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addInventoryItem,
  type AddItemState,
} from "@/app/actions/inventory";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { LocationType } from "@/lib/inventory/types";

type AddItemFormProps = {
  activeLocation: LocationType;
};

const initialState: AddItemState = { error: null, ok: false };

export function AddItemForm({ activeLocation }: AddItemFormProps) {
  const [state, formAction, pending] = useActionState(
    addInventoryItem,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} className="add-item-form" action={formAction}>
      <h3 className="add-item-form__title">Add item</h3>

      <label className="auth-field">
        <span>Name</span>
        <input name="name" type="text" required placeholder="Milk" />
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
            placeholder="1"
          />
        </label>

        <label className="auth-field">
          <span>Unit</span>
          <select name="unit" required defaultValue="pieces">
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
        <select name="locationType" required defaultValue={activeLocation} key={activeLocation}>
          {LOCATION_ORDER.map((location) => (
            <option key={location} value={location}>
              {LOCATION_LABELS[location]}
            </option>
          ))}
        </select>
      </label>

      <label className="auth-field">
        <span>Expiry (optional)</span>
        <input name="expiresOn" type="date" />
      </label>

      <label className="auth-field">
        <span>Notes (optional)</span>
        <input name="notes" type="text" placeholder="Opened yesterday" />
      </label>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
      {state.ok ? <p className="auth-success">Added to inventory.</p> : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to inventory"}
      </button>
    </form>
  );
}
