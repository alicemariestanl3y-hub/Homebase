"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInventoryItemClient } from "@/lib/inventory/client-mutations";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import {
  guessDefaultUnit,
  rememberUnitForProduct,
  rememberedUnitForProduct,
} from "@/lib/inventory/product-names";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { InventoryUnit, LocationType } from "@/lib/inventory/types";
import { QuantityInput } from "./QuantityInput";

type AddItemFormProps = {
  activeLocation: LocationType;
};

function isInventoryUnit(value: string): value is InventoryUnit {
  return (INVENTORY_UNITS as readonly string[]).includes(value);
}

export function AddItemForm({ activeLocation }: AddItemFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryUnit>("pieces");
  const [qtyKey, setQtyKey] = useState(0);

  useEffect(() => {
    if (!name.trim()) return;
    const remembered = rememberedUnitForProduct(name);
    if (remembered && isInventoryUnit(remembered)) {
      setUnit(remembered);
      return;
    }
    const guessed = guessDefaultUnit(name);
    if (isInventoryUnit(guessed)) setUnit(guessed);
  }, [name]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(false);

    const formData = new FormData(event.currentTarget);
    const productName = String(formData.get("name") ?? "").trim();
    const productUnit = String(formData.get("unit") ?? "");

    startTransition(async () => {
      const result = await addInventoryItemClient(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (productName && isInventoryUnit(productUnit)) {
        rememberUnitForProduct(productName, productUnit);
      }
      setOk(true);
      formRef.current?.reset();
      setName("");
      setUnit("pieces");
      setQtyKey((value) => value + 1);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} className="add-item-form" onSubmit={onSubmit}>
      <h3 className="add-item-form__title">Add item</h3>

      <label className="auth-field">
        <span>Name</span>
        <input
          name="name"
          type="text"
          required
          placeholder="Milk"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="add-item-form__row">
        <QuantityInput
          key={qtyKey}
          name="quantity"
          label="Qty"
          initialValue={null}
          required
        />

        <label className="auth-field">
          <span>Unit</span>
          <select
            name="unit"
            required
            value={unit}
            onChange={(event) =>
              setUnit(event.target.value as InventoryUnit)
            }
          >
            {INVENTORY_UNITS.map((option) => (
              <option key={option} value={option}>
                {UNIT_LABELS[option]}
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
