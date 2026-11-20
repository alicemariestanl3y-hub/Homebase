"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { filesToResizedDataUrls } from "@/lib/capture/client-resize";
import { findDuplicateMatches } from "@/lib/capture/duplicates";
import type { CapturedCandidate, DuplicateMatch } from "@/lib/capture/types";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { InventoryItem, LocationType } from "@/lib/inventory/types";

type SmartCaptureFlowProps = {
  existingItems: InventoryItem[];
  locationById: Record<string, LocationType>;
};

type Step = "photos" | "review";

export function SmartCaptureFlow({
  existingItems,
  locationById,
}: SmartCaptureFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photos");
  const [previews, setPreviews] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CapturedCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, startTransition] = useTransition();

  const resetToPhotos = useCallback(() => {
    setStep("photos");
    setPreviews([]);
    setCandidates([]);
    setError(null);
    setInfo(null);
    setAnalyzing(false);
  }, []);

  // iOS/Safari bfcache can restore a frozen review screen when revisiting.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) resetToPhotos();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetToPhotos]);

  const locationMap = useMemo(
    () => new Map(Object.entries(locationById)) as Map<string, LocationType>,
    [locationById],
  );

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    try {
      const urls = await filesToResizedDataUrls(Array.from(fileList));
      if (urls.length === 0) {
        setError("Please choose image files from your camera or library.");
        return;
      }
      setPreviews((prev) => [...prev, ...urls].slice(0, 6));
    } catch {
      setError("Could not prepare those photos. Try again with JPEG or HEIC converted images.");
    }
  }

  async function analyze() {
    if (previews.length === 0) {
      setError("Add at least one photo first.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/capture/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: previews }),
      });
      const json = (await response.json()) as {
        candidates?: CapturedCandidate[];
        error?: string;
        warning?: string;
      };
      if (!response.ok) {
        throw new Error(json.error || "Analysis failed.");
      }
      const next = (json.candidates ?? []).map((item) => ({
        ...item,
        selected: true,
        mergeWithItemId: null,
      }));
      setCandidates(next);
      setInfo(json.warning ?? null);
      setStep("review");
      // Drop photo payloads from memory after analysis.
      setPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateCandidate(
    id: string,
    patch: Partial<CapturedCandidate>,
  ) {
    setCandidates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function duplicatesFor(candidate: CapturedCandidate): DuplicateMatch[] {
    return findDuplicateMatches(candidate, existingItems, locationMap);
  }

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch("/api/capture/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ candidates }),
        });

        let result: { error: string | null; savedCount: number };
        try {
          result = (await response.json()) as {
            error: string | null;
            savedCount: number;
          };
        } catch {
          setError(
            `Save failed (${response.status}). The server did not return JSON — items may not have reached Supabase.`,
          );
          return;
        }

        if (!response.ok || result.error) {
          setError(result.error || `Save failed (${response.status}).`);
          return;
        }

        resetToPhotos();
        router.push("/inventory");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Network error while saving.",
        );
      }
    });
  }

  return (
    <div className="capture-flow">
      <div className="capture-hero">
        <p className="hb-kicker">Smart Inventory Capture</p>
        <h1 className="section-title" style={{ fontSize: "1.45rem", marginTop: "0.35rem" }}>
          {step === "photos" ? "Photograph your kitchen" : "Review before saving"}
        </h1>
        <p style={{ color: "var(--hb-muted)", margin: "0.45rem 0 0", lineHeight: 1.45 }}>
          {step === "photos"
            ? "Take or upload shelf photos. We’ll resize them, identify products, then let you approve everything."
            : "Correct uncertain items, merge duplicates, and only then save to your household inventory."}
        </p>
        {step === "photos" ? (
          <p style={{ margin: "0.65rem 0 0", fontSize: "0.9rem" }}>
            Importing an online order instead?{" "}
            <Link href="/grocery" style={{ textDecoration: "underline" }}>
              Open grocery import
            </Link>
          </p>
        ) : null}
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {info ? <p className="auth-success">{info}</p> : null}

      {step === "photos" ? (
        <section className="capture-drop">
          <p style={{ margin: 0, fontWeight: 700 }}>Photos (up to 6)</p>
          <p style={{ margin: "0.35rem 0 0", color: "var(--hb-muted)", fontSize: "0.9rem" }}>
            Pantry shelves, fridge shelves, freezer contents or grocery bags.
          </p>

          <div className="capture-actions">
            <label className="hb-btn" style={{ textAlign: "center" }}>
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                multiple
                onChange={(event) => {
                  void onFilesSelected(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="hb-btn hb-btn--ghost" style={{ textAlign: "center" }}>
              Upload
              <input
                type="file"
                accept="image/*"
                hidden
                multiple
                onChange={(event) => {
                  void onFilesSelected(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {previews.length > 0 ? (
            <div className="capture-previews">
              {previews.map((src) => (
                // Local data URLs only — discarded after analysis.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src.slice(0, 64)} src={src} alt="Selected grocery photo" />
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="hb-btn"
            style={{ width: "100%", marginTop: "1rem" }}
            disabled={analyzing || previews.length === 0}
            onClick={() => void analyze()}
          >
            {analyzing ? "Identifying products…" : `Analyse ${previews.length || ""} photo${previews.length === 1 ? "" : "s"}`}
          </button>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "var(--hb-muted)" }}>
            Photos are resized on your phone, sent securely for analysis, then discarded. Expiry dates are only kept when clearly readable.
          </p>
        </section>
      ) : null}

      {step === "review" ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {candidates.length === 0 ? (
            <p className="hb-empty">No items to review. Try another photo.</p>
          ) : (
            candidates.map((candidate) => {
              const dupes = duplicatesFor(candidate);
              return (
                <article
                  key={candidate.id}
                  className={`review-card${candidate.needsReview || candidate.confidence !== "high" ? " is-uncertain" : ""}`}
                >
                  <div className="review-card__top">
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={candidate.selected !== false}
                        onChange={(event) =>
                          updateCandidate(candidate.id, {
                            selected: event.target.checked,
                          })
                        }
                      />
                      Keep this item
                    </label>
                    <span className={`confidence-pill confidence-pill--${candidate.confidence}`}>
                      {candidate.confidence}
                      {candidate.needsReview ? " · review" : ""}
                    </span>
                  </div>

                  <label className="auth-field">
                    <span>Name</span>
                    <input
                      value={candidate.name}
                      onChange={(event) =>
                        updateCandidate(candidate.id, { name: event.target.value })
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
                          Number.isFinite(candidate.quantity) &&
                          candidate.quantity > 0
                            ? String(candidate.quantity)
                            : ""
                        }
                        placeholder=""
                        onChange={(event) => {
                          const raw = event.target.value.replace(",", ".");
                          if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                          updateCandidate(candidate.id, {
                            quantity: raw === "" ? 0 : Number(raw),
                          });
                        }}
                      />
                    </label>
                    <label className="auth-field">
                      <span>Unit</span>
                      <select
                        value={candidate.unit}
                        onChange={(event) =>
                          updateCandidate(candidate.id, {
                            unit: event.target.value as CapturedCandidate["unit"],
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

                  <label className="auth-field">
                    <span>Location</span>
                    <select
                      value={candidate.suggestedLocation}
                      onChange={(event) =>
                        updateCandidate(candidate.id, {
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
                    <span>Expiry (only if readable — leave blank if unsure)</span>
                    <input
                      type="date"
                      value={candidate.expiresOn ?? ""}
                      onChange={(event) =>
                        updateCandidate(candidate.id, {
                          expiresOn: event.target.value || null,
                        })
                      }
                    />
                  </label>

                  {candidate.brand || candidate.packageSize ? (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--hb-muted)" }}>
                      {[candidate.brand, candidate.packageSize].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}

                  {dupes.length > 0 ? (
                    <label className="auth-field">
                      <span>Possible duplicate — add quantity to existing?</span>
                      <select
                        value={candidate.mergeWithItemId ?? ""}
                        onChange={(event) =>
                          updateCandidate(candidate.id, {
                            mergeWithItemId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Save as new item</option>
                        {dupes.map((dupe) => (
                          <option key={dupe.itemId} value={dupe.itemId}>
                            {dupe.itemName} ({dupe.quantity} {dupe.unit} · {LOCATION_LABELS[dupe.locationType]})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </article>
              );
            })
          )}

          <button type="button" className="hb-btn" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save approved items"}
          </button>
          <button
            type="button"
            className="hb-btn hb-btn--ghost"
            onClick={resetToPhotos}
          >
            Back to photos
          </button>
        </section>
      ) : null}
    </div>
  );
}
