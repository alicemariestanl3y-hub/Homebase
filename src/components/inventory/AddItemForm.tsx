"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInventoryItemClient } from "@/lib/inventory/client-mutations";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { LocationType } from "@/lib/inventory/types";

type AddItemFormProps = {
  activeLocation: LocationType;
};

export function AddItemForm({ activeLocation }: AddItemFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(false);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addInventoryItemClient(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOk(true);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} className="add-item-form" onSubmit={onSubmit}>
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
        <select
          name="locationType"
          required
          defaultValue={activeLocation}
          key={activeLocation}
        >
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

      {error ? <p className="auth-error">{error}</p> : null}
      {ok ? <p className="auth-success">Added to inventory.</p> : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to inventory"}
      </button>
    </form>
  );
}
