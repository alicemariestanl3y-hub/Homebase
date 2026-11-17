"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { filesToResizedDataUrls } from "@/lib/capture/client-resize";
import { findIngredientMatches } from "@/lib/ingredients/matching";
import type { GroceryCandidate, GrocerySourceType } from "@/lib/grocery/types";
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
  const [sourceType, setSourceType] = useState<GrocerySourceType>("screenshot");
  const [pastedText, setPastedText] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<GroceryCandidate[]>([]);
  const [contentHash, setContentHash] = useState("");
  const [fulfillment, setFulfillment] = useState<
    "ordered" | "delivered" | "mixed" | "unknown"
  >("unknown");
  const [retailer, setRetailer] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
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
        "For PDFs, paste the itemised text from the order email/PDF, or upload receipt screenshots. Image-based PDFs aren’t OCR’d yet.",
      );
      setSourceType("pasted_list");
      return;
    }
    try {
      const urls = await filesToResizedDataUrls(files);
      if (urls.length === 0) {
        setError("Choose image/screenshot files (JPEG, PNG, HEIC converted).");
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
      const response = await fetch("/api/grocery/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sourceType:
            previews.length > 0
              ? sourceType === "pasted_list"
                ? "screenshot"
                : sourceType
              : "pasted_list",
          text: pastedText,
          images: previews,
        }),
      });
      const json = (await response.json()) as {
        candidates?: GroceryCandidate[];
        contentHash?: string;
        fulfillment?: typeof fulfillment;
        retailer?: string | null;
        orderReference?: string | null;
        error?: string;
        warning?: string;
      };
      if (!response.ok) throw new Error(json.error || "Analysis failed.");

      setCandidates(
        (json.candidates ?? []).map((item) => ({
          ...item,
          selected: true,
          mergeWithItemId: item.mergeWithItemId ?? null,
        })),
      );
      setContentHash(json.contentHash ?? "");
      setFulfillment(json.fulfillment ?? "unknown");
      setRetailer(json.retailer ?? null);
      setOrderReference(json.orderReference ?? null);
      setInfo(json.warning ?? null);
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
            orderReference,
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
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  }

  return (
    <div className="capture-flow">
      <div className="capture-hero">
        <p className="hb-kicker">Grocery import</p>
        <h1
          className="section-title"
          style={{ fontSize: "1.45rem", marginTop: "0.35rem" }}
        >
          {step === "source" ? "Bring in an order" : "Review before stocking"}
        </h1>
        <p style={{ color: "var(--hb-muted)", margin: "0.45rem 0 0", lineHeight: 1.45 }}>
          {step === "source"
            ? "Upload receipt screenshots or paste an itemised list from an email. Email inbox sync can plug into this same review flow later."
            : "Correct quantities, mark ordered vs delivered, merge duplicates, then save into your household inventory."}
        </p>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {info ? <p className="auth-success">{info}</p> : null}

      {step === "source" ? (
        <section className="capture-drop">
          <label className="auth-field">
            <span>Paste itemised list</span>
            <textarea
              className="hb-textarea"
              rows={6}
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Milk 2L x2&#10;Sourdough loaf&#10;Chicken mince 500g"
            />
          </label>

          <p style={{ margin: "1rem 0 0.35rem", fontWeight: 700 }}>
            Or upload screenshots
          </p>
          <p style={{ margin: 0, color: "var(--hb-muted)", fontSize: "0.9rem" }}>
            Online grocery order confirmations and paper receipts (up to 6 images).
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
          </div>

          {candidates.map((item) => {
            const duplicates = findIngredientMatches(item, matchCandidates, 3);
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

                <label className="auth-field">
                  <span>Product</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(event) =>
                      updateCandidate(item.id, { name: event.target.value })
                    }
                  />
                </label>

                <div className="add-item-form__row">
                  <label className="auth-field">
                    <span>Qty</span>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={item.quantity}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          quantity: Number(event.target.value),
                        })
                      }
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
                    <span>Location</span>
                    <select
                      value={item.suggestedLocation}
                      onChange={(event) =>
                        updateCandidate(item.id, {
                          suggestedLocation: event.target
                            .value as LocationType,
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

                {item.needsReview ? (
                  <p className="confidence-pill">Needs review</p>
                ) : null}
              </article>
            );
          })}

          <div className="inventory-row__actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="hb-btn hb-btn--ghost"
              onClick={() => setStep("source")}
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
