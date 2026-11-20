"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { filesToResizedDataUrls } from "@/lib/capture/client-resize";
import { findIngredientMatches } from "@/lib/ingredients/matching";
import type {
  GroceryCandidate,
  GroceryRetailerCode,
  GrocerySourceType,
} from "@/lib/grocery/types";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { InventoryItem, LocationType } from "@/lib/inventory/types";

type GroceryImportFlowProps = {
  existingItems: InventoryItem[];
  locationById: Record<string, LocationType>;
};

type Step = "source" | "review";

export function GroceryImportFlow({
  existingItems,
  locationById,
}: GroceryImportFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("source");
  const [sourceType, setSourceType] = useState<GrocerySourceType>("email");
  const [pastedText, setPastedText] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<GroceryCandidate[]>([]);
  const [contentHash, setContentHash] = useState("");
  const [fulfillment, setFulfillment] = useState<
    "ordered" | "delivered" | "mixed" | "unknown"
  >("unknown");
  const [retailer, setRetailer] = useState<string | null>(null);
  const [retailerCode, setRetailerCode] = useState<GroceryRetailerCode | null>(
    null,
  );
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [currency, setCurrency] = useState("AUD");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, startTransition] = useTransition();

  const matchCandidates = useMemo(
    () =>
      existingItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    [existingItems],
  );

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList);
    const pdfs = files.filter((file) => file.type === "application/pdf");
    if (pdfs.length > 0 && files.every((file) => file.type === "application/pdf")) {
      setError(
        "For PDFs, paste the Woolworths email HTML/text, or upload screenshots of the item table.",
      );
      setSourceType("email");
      return;
    }
    try {
      const urls = await filesToResizedDataUrls(files);
      if (urls.length === 0) {
        setError("Choose image/screenshot files (JPEG, PNG).");
        return;
      }
      setSourceType("screenshot");
      setPreviews((prev) => [...prev, ...urls].slice(0, 6));
    } catch {
      setError("Could not prepare those images.");
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setInfo(null);
    try {
      const usingImages = previews.length > 0;
      const response = await fetch("/api/grocery/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sourceType: usingImages ? "screenshot" : "email",
          text: pastedText,
          images: previews,
        }),
      });
      const json = (await response.json()) as {
        candidates?: GroceryCandidate[];
        contentHash?: string;
        fulfillment?: typeof fulfillment;
        retailer?: string | null;
        retailerCode?: GroceryRetailerCode | null;
        orderReference?: string | null;
        orderTotal?: number | null;
        currency?: string;
        parser?: string;
        error?: string;
        warning?: string;
      };
      if (!response.ok) throw new Error(json.error || "Analysis failed.");

      setCandidates(
        (json.candidates ?? []).map((item) => ({
          ...item,
          selected: item.selected !== false && item.isFood !== false,
          mergeWithItemId: item.mergeWithItemId ?? null,
          originalName: item.originalName ?? item.name,
          standardizedName: item.standardizedName ?? item.name,
          unitPrice: item.unitPrice ?? null,
          linePrice: item.linePrice ?? null,
          currency: item.currency || "AUD",
          isFood: item.isFood !== false,
          wasSubstituted: Boolean(item.wasSubstituted),
          substitutionNote: item.substitutionNote ?? null,
        })),
      );
      setContentHash(json.contentHash ?? "");
      setFulfillment(json.fulfillment ?? "unknown");
      setRetailer(json.retailer ?? null);
      setRetailerCode(json.retailerCode ?? null);
      setOrderReference(json.orderReference ?? null);
      setOrderTotal(json.orderTotal ?? null);
      setCurrency(json.currency ?? "AUD");
      setInfo(
        json.warning ??
          (json.parser === "woolworths_html"
            ? "Recognised Woolworths item table. Check locations and non-food lines before saving."
            : null),
      );
      setStep("review");
      setPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateCandidate(id: string, patch: Partial<GroceryCandidate>) {
    setCandidates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch("/api/grocery/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            contentHash,
            sourceType,
            sourceLabel: retailer,
            fulfillment,
            retailer,
            retailerCode,
            orderReference,
            currency,
            orderTotal,
            candidates,
          }),
        });
        const result = (await response.json()) as {
          error: string | null;
          savedCount: number;
          duplicate?: boolean;
        };
        if (!response.ok || result.error) {
          setError(result.error || `Save failed (${response.status}).`);
          return;
        }
        router.push("/inventory");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  }

  return (
    <div className="capture-flow">
      <div className="capture-hero">
        <p className="hb-kicker">Grocery import · Woolworths ready</p>
        <h1
          className="section-title"
          style={{ fontSize: "1.45rem", marginTop: "0.35rem" }}
        >
          {step === "source" ? "Import a Woolworths order" : "Review before stocking"}
        </h1>
        <p style={{ color: "var(--hb-muted)", margin: "0.45rem 0 0", lineHeight: 1.45 }}>
          {step === "source"
            ? "Paste the Woolworths order email (HTML table with Item description, Unit price, Qty, Price) or upload screenshots. A future HomeBase inbox can feed this same review step."
            : "Confirm pantry/fridge/freezer, include non-food only if you want, merge duplicates, then save. Prices are kept for spending insights."}
        </p>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {info ? <p className="auth-success">{info}</p> : null}

      {step === "source" ? (
        <section className="capture-drop">
          <label className="auth-field">
            <span>Paste Woolworths email (HTML or text)</span>
            <textarea
              className="hb-textarea"
              rows={8}
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setSourceType("email");
              }}
              placeholder="Paste the itemised order email here — including the product table."
            />
          </label>

          <p style={{ margin: "1rem 0 0.35rem", fontWeight: 700 }}>
            Or upload screenshots
          </p>
          <p style={{ margin: 0, color: "var(--hb-muted)", fontSize: "0.9rem" }}>
            Screenshots of the Woolworths item table (up to 6 images).
          </p>
          <input
            className="hb-file"
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(event) => onFilesSelected(event.target.files)}
          />
          {previews.length > 0 ? (
            <p className="auth-success">{previews.length} image(s) ready</p>
          ) : null}

          <button
            type="button"
            className="auth-submit"
            style={{ marginTop: "1rem" }}
            disabled={analyzing || (!pastedText.trim() && previews.length === 0)}
            onClick={analyze}
          >
            {analyzing ? "Reading order…" : "Extract products"}
          </button>
        </section>
      ) : (
        <section className="review-list">
          <div className="hb-meta-row">
            <span>{retailer || "Grocery order"}</span>
            <span>{fulfillment}</span>
            {orderReference ? <span>Ref {orderReference}</span> : null}
            {orderTotal != null ? (
              <span>
                Total ${orderTotal.toFixed(2)} {currency}
              </span>
            ) : null}
          </div>

          {candidates.map((item) => {
            const duplicates = findIngredientMatches(
              {
                name: item.standardizedName || item.name,
                ingredientKey: item.ingredientKey,
              },
              matchCandidates,
              3,
            );
            return (
              <article key={item.id} className="review-card">
                <label className="review-card__select">
                  <input
                    type="checkbox"
                    checked={item.selected !== false}
                    onChange={(event) =>
                      updateCandidate(item.id, {
                        selected: event.target.checked,
                      })
                    }
                  />
                  <span>Include</span>
                </label>

                {!item.isFood ? (
                  <p className="confidence-pill">Non-food (excluded by default)</p>
                ) : null}
                {item.wasSubstituted ? (
                  <p className="confidence-pill">Substitution</p>
                ) : null}

                <label className="auth-field">
                  <span>Woolworths name (original)</span>
                  <input
                    type="text"
                    value={item.originalName || item.name}
                    onChange={(event) =>
                      updateCandidate(item.id, {
                        originalName: event.target.value,
                        name: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="auth-field">
                  <span>Standard name (recipe matching)</span>
                  <input
                    type="text"
                    value={item.standardizedName || ""}
                    onChange={(event) =>
                      updateCandidate(item.id, {
                        standardizedName: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="add-item-form__row">
                  <label className="auth-field">
                    <span>Qty</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={
                        Number.isFinite(item.quantity) && item.quantity > 0
                          ? String(item.quantity)
                          : ""
                      }
                      placeholder=""
                      onChange={(event) => {
                        const raw = event.target.value.replace(",", ".");
                        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                        updateCandidate(item.id, {
                          quantity: raw === "" ? 0 : Number(raw),
                        });
                      }}
                    />
                  </label>
                  <label className="auth-field">
                    <span>Unit</span>
                    <select
                      value={item.unit}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          unit: event.target.value as GroceryCandidate["unit"],
                        })
                      }
                    >
                      {INVENTORY_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {UNIT_LABELS[unit]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="add-item-form__row">
                  <label className="auth-field">
                    <span>Unit price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice ?? ""}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          unitPrice:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="auth-field">
                    <span>Line price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.linePrice ?? ""}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          linePrice:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="add-item-form__row">
                  <label className="auth-field">
                    <span>Location</span>
                    <select
                      value={item.suggestedLocation}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          suggestedLocation: event.target.value as LocationType,
                        })
                      }
                    >
                      {LOCATION_ORDER.map((location) => (
                        <option key={location} value={location}>
                          {LOCATION_LABELS[location]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>Status</span>
                    <select
                      value={item.lineFulfillment}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          lineFulfillment: event.target.value as
                            | "ordered"
                            | "delivered",
                        })
                      }
                    >
                      <option value="delivered">Delivered → stock</option>
                      <option value="ordered">Ordered only</option>
                    </select>
                  </label>
                </div>

                <label className="hb-check">
                  <input
                    type="checkbox"
                    checked={item.isFood}
                    onChange={(event) =>
                      updateCandidate(item.id, {
                        isFood: event.target.checked,
                        selected: event.target.checked
                          ? item.selected !== false
                          : item.selected,
                      })
                    }
                  />
                  Food item (for kitchen inventory)
                </label>

                {duplicates.length > 0 ? (
                  <label className="auth-field">
                    <span>Merge with existing</span>
                    <select
                      value={item.mergeWithItemId ?? ""}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          mergeWithItemId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Add as new item</option>
                      {duplicates.map((match) => {
                        const existing = existingItems.find(
                          (row) => row.id === match.id,
                        );
                        const locationType = existing
                          ? locationById[existing.locationId]
                          : item.suggestedLocation;
                        return (
                          <option key={match.id} value={match.id}>
                            {match.name} ({match.quantity} {match.unit})
                            {locationType
                              ? ` — ${LOCATION_LABELS[locationType]}`
                              : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null}
              </article>
            );
          })}

          <div className="inventory-row__actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="hb-btn hb-btn--ghost"
              onClick={() => {
                setStep("source");
                setCandidates([]);
                setPreviews([]);
                setPastedText("");
                setError(null);
                setInfo(null);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="auth-submit"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save approved items"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
