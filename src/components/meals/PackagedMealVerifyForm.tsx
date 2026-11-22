"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { CatalogProduct } from "@/lib/packaged-meals/types";
import type { InventoryUnit } from "@/lib/inventory/types";
import { DEFAULT_HOUSEHOLD_ALLERGENS } from "@/lib/packaged-meals/types";
import {
  clearPacketDraft,
  readPacketDraft,
  readPacketImages,
} from "@/lib/packaged-meals/draft-storage";
import type { PacketRecipeDraft } from "@/lib/packaged-meals/extract-packet-recipe";
import { QuantityInput } from "@/components/inventory/QuantityInput";

type Line = {
  name: string;
  quantity: string;
  unit: InventoryUnit | "";
  notes: string;
};

type PackagedMealVerifyFormProps = {
  product: CatalogProduct;
};

function linesFromDraft(
  rows: PacketRecipeDraft["included"] | PacketRecipeDraft["additionalIngredients"],
  fallbackUnit: InventoryUnit | "",
): Line[] {
  if (!rows.length) {
    return [{ name: "", quantity: "", unit: fallbackUnit, notes: "" }];
  }
  return rows.map((row) => ({
    name: row.name,
    quantity: row.quantity != null ? String(row.quantity) : "",
    unit: (row.unit as InventoryUnit | "") || fallbackUnit,
    notes: "",
  }));
}

export function PackagedMealVerifyForm({ product }: PackagedMealVerifyFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(
    () =>
      product.displayName.replace(/recipe base/i, "").trim() ||
      product.displayName,
  );
  const [servings, setServings] = useState("4");
  const [packetsRequired, setPacketsRequired] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [instructionsSource, setInstructionsSource] = useState<
    "user_typed" | "user_packet_photo"
  >("user_typed");
  const [included, setIncluded] = useState<Line[]>([
    {
      name: product.displayName,
      quantity: "1",
      unit: "packets",
      notes: "",
    },
  ]);
  const [additional, setAdditional] = useState<Line[]>([
    { name: "", quantity: "", unit: "g", notes: "" },
  ]);
  const [allergenStatus, setAllergenStatus] = useState<
    "unverified" | "verified_clear" | "contains_restricted" | "may_contain"
  >("unverified");
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [allergenNotes, setAllergenNotes] = useState("");
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const draft = readPacketDraft(product.id);
    if (draft) {
      applyDraft(draft);
      return;
    }
    const images = readPacketImages(product.id);
    if (images.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/packaged-meals/extract-packet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images,
            productName: product.displayName,
            brand: product.brand,
          }),
        });
        const json = (await response.json()) as { draft?: PacketRecipeDraft };
        if (!cancelled && json.draft) applyDraft(json.draft);
      } catch {
        // Manual entry still works.
      }
    })();
    return () => {
      cancelled = true;
    };

    function applyDraft(draft: PacketRecipeDraft) {
      if (draft.title) setTitle(draft.title);
      if (draft.servings) setServings(String(draft.servings));
      if (draft.packetsRequired) setPacketsRequired(String(draft.packetsRequired));
      if (draft.instructions) {
        setInstructions(draft.instructions);
        setInstructionsSource("user_packet_photo");
      }
      if (draft.included.length) {
        setIncluded(linesFromDraft(draft.included, "packets"));
      }
      if (draft.additionalIngredients.length) {
        setAdditional(linesFromDraft(draft.additionalIngredients, "g"));
      }
      setDraftNote(draft.notes);
      setSourceReference(
        draft.source === "packet_photo" ? "Extracted from packet photo" : "",
      );
    }
  }, [product.id, product.displayName, product.brand]);

  const label = useMemo(
    () =>
      [product.brand, product.displayName, product.variant, product.packSize]
        .filter(Boolean)
        .join(" · "),
    [product],
  );

  function updateLine(
    list: Line[],
    setList: (rows: Line[]) => void,
    index: number,
    patch: Partial<Line>,
  ) {
    setList(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const includedClean = included
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity ? Number(row.quantity) : null,
        unit: (row.unit || null) as InventoryUnit | null,
        notes: row.notes || null,
      }));
    const additionalClean = additional
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity ? Number(row.quantity) : null,
        unit: (row.unit || null) as InventoryUnit | null,
        notes: row.notes || null,
      }));

    startTransition(async () => {
      const response = await fetch("/api/packaged-meals/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogProductId: product.id,
          title,
          servingsPerPacket: Number(servings) || 4,
          packetsRequired: Number(packetsRequired) || 1,
          instructions,
          instructionsSource,
          sourceReference: sourceReference || null,
          included: includedClean,
          additionalIngredients: additionalClean,
          allergens: selectedAllergens,
          allergenStatus,
          allergenNotes: allergenNotes || null,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        def?: { recipeId: string };
      };
      if (!response.ok || !json.def) {
        setError(json.error || "Could not save verified packet meal.");
        return;
      }
      clearPacketDraft(product.id);
      router.push(`/meals/${json.def.recipeId}`);
      router.refresh();
    });
  }

  return (
    <form className="packet-verify" onSubmit={onSubmit}>
      <p className="hb-kicker">Verify packet once</p>
      <h1 className="section-title" style={{ marginTop: "0.35rem" }}>
        {label}
      </h1>
      <p style={{ color: "var(--hb-muted)", lineHeight: 1.45 }}>
        Confirm cooking instructions and ingredients from this exact product.
        HomeBase reuses them the next time you buy the same pack — it will not
        invent ingredients or steps.
      </p>
      {draftNote ? (
        <p className="auth-success" style={{ marginTop: "0.75rem" }}>
          {draftNote}
        </p>
      ) : null}

      <label className="auth-field">
        <span>Meal title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>

      <div className="add-item-form__row">
        <label className="auth-field">
          <span>Serves per packet</span>
          <input
            type="text"
            inputMode="decimal"
            value={servings}
            onChange={(event) => setServings(event.target.value)}
            required
          />
        </label>
        <label className="auth-field">
          <span>Packets required</span>
          <input
            type="text"
            inputMode="decimal"
            value={packetsRequired}
            onChange={(event) => setPacketsRequired(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="auth-field">
        <span>Packet cooking instructions</span>
        <textarea
          rows={6}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          required
          placeholder="Type exactly what the packet says…"
        />
      </label>

      <label className="auth-field">
        <span>Source reference (optional)</span>
        <input
          value={sourceReference}
          onChange={(event) => setSourceReference(event.target.value)}
          placeholder="Packet photo note / pack code"
        />
      </label>

      <IngredientEditor
        title="Included in the packet"
        help="These stay out of the shopping list and are not deducted separately."
        rows={included}
        onChange={setIncluded}
        updateLine={updateLine}
      />

      <IngredientEditor
        title="Additional ingredients required"
        help="Only what you still need to buy or pull from the fridge/pantry."
        rows={additional}
        onChange={setAdditional}
        updateLine={updateLine}
      />

      <fieldset className="packet-allergens">
        <legend>Allergy safety</legend>
        <p className="hb-item-meta">
          Household watches:{" "}
          {DEFAULT_HOUSEHOLD_ALLERGENS.map((row) => row.displayName).join(", ")}.
          Leave unverified if you have not checked the packet.
        </p>
        <label className="auth-field">
          <span>Allergen status</span>
          <select
            value={allergenStatus}
            onChange={(event) =>
              setAllergenStatus(
                event.target.value as typeof allergenStatus,
              )
            }
          >
            <option value="unverified">Unverified — do not treat as safe</option>
            <option value="verified_clear">Verified clear of household restrictions</option>
            <option value="contains_restricted">Contains a restricted allergen</option>
            <option value="may_contain">May contain / precautionary</option>
          </select>
        </label>
        <div className="hb-allergen-checks">
          {DEFAULT_HOUSEHOLD_ALLERGENS.map((row) => (
            <label key={row.allergenKey} className="hb-check">
              <input
                type="checkbox"
                checked={selectedAllergens.includes(row.allergenKey)}
                onChange={(event) => {
                  setSelectedAllergens((prev) =>
                    event.target.checked
                      ? [...prev, row.allergenKey]
                      : prev.filter((key) => key !== row.allergenKey),
                  );
                }}
              />
              {row.displayName}
            </label>
          ))}
        </div>
        <label className="auth-field">
          <span>Allergen notes</span>
          <input
            value={allergenNotes}
            onChange={(event) => setAllergenNotes(event.target.value)}
            placeholder="As printed on the packet"
          />
        </label>
      </fieldset>

      {error ? <p className="auth-error">{error}</p> : null}

      <button className="hb-btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save verified packet meal"}
      </button>
    </form>
  );
}

function IngredientEditor({
  title,
  help,
  rows,
  onChange,
  updateLine,
}: {
  title: string;
  help: string;
  rows: Line[];
  onChange: (rows: Line[]) => void;
  updateLine: (
    list: Line[],
    setList: (rows: Line[]) => void,
    index: number,
    patch: Partial<Line>,
  ) => void;
}) {
  return (
    <div className="packet-ingredients">
      <h2 className="section-title">{title}</h2>
      <p className="hb-item-meta">{help}</p>
      {rows.map((row, index) => (
        <div key={index} className="packet-ingredients__row">
          <label className="auth-field">
            <span>Name</span>
            <input
              value={row.name}
              onChange={(event) =>
                updateLine(rows, onChange, index, {
                  name: event.target.value,
                })
              }
            />
          </label>
          <div className="add-item-form__row">
            <QuantityInput
              name={`qty-${title}-${index}`}
              label="Qty"
              initialValue={row.quantity ? Number(row.quantity) : null}
              required={false}
              onValueChange={(value) =>
                updateLine(rows, onChange, index, {
                  quantity: value == null ? "" : String(value),
                })
              }
            />
            <label className="auth-field">
              <span>Unit</span>
              <select
                value={row.unit}
                onChange={(event) =>
                  updateLine(rows, onChange, index, {
                    unit: event.target.value as InventoryUnit | "",
                  })
                }
              >
                <option value="">—</option>
                {INVENTORY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="hb-btn hb-btn--ghost"
        onClick={() =>
          onChange([
            ...rows,
            { name: "", quantity: "", unit: "g", notes: "" },
          ])
        }
      >
        Add line
      </button>
    </div>
  );
}
