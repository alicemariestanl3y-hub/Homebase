"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type {
  CatalogProduct,
  MealRecommendation,
} from "@/lib/packaged-meals/types";

type Payload = {
  recommendations: MealRecommendation[];
  pendingBases: CatalogProduct[];
  error?: string;
};

export function MealRecommendations() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/packaged-meals/recommendations");
        const json = (await response.json()) as Payload & { error?: string };
        if (!response.ok) throw new Error(json.error || "Failed to load.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addToPlan(recommendation: MealRecommendation) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/packaged-meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation }),
      });
      const json = (await response.json()) as {
        error?: string;
        shoppingItemCount?: number;
      };
      if (!response.ok) {
        setError(json.error || "Could not add to plan.");
        return;
      }
      setMessage(
        `Added to this week’s plan. ${json.shoppingItemCount ?? 0} shopping line${
          (json.shoppingItemCount ?? 0) === 1 ? "" : "s"
        } (packet contents excluded).`,
      );
    });
  }

  if (error && !data) {
    return <p className="auth-error">{error}</p>;
  }

  if (!data) {
    return <p className="hb-empty">Checking pantry for packet meals…</p>;
  }

  return (
    <section className="hb-meal-rec" aria-labelledby="meal-rec-heading">
      <div className="hb-panel-head">
        <h2 id="meal-rec-heading">Cook from what you have</h2>
      </div>
      <p className="hb-meal-rec__lead">
        Recipe bases and kits in your pantry are prioritised. Unverified allergen
        info is flagged — never treated as safe.
      </p>

      {message ? <p className="auth-success">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}

      {data.pendingBases.length > 0 ? (
        <div className="hb-meal-pending">
          <h3 className="hb-meal-pending__title">Needs packet instructions</h3>
          <ul className="hb-meal-pending__list">
            {data.pendingBases.map((product) => (
              <li key={product.id}>
                <div>
                  <p className="hb-item-name">
                    {[product.brand, product.displayName, product.variant]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="hb-item-meta">
                    Suggested: {product.kindSuggested ?? product.productKind}
                    {product.allergenStatus === "unverified"
                      ? " · Allergens unverified"
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/meals/packet/new?productId=${product.id}`}
                  className="hb-btn hb-btn--ghost"
                >
                  Verify packet
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.recommendations.length === 0 ? (
        <p className="hb-empty">
          No packet-meal matches yet. Add Mingle bases or taco kits to inventory,
          then verify their packet instructions once.
        </p>
      ) : (
        <ul className="hb-meal-rec__list">
          {data.recommendations.slice(0, 8).map((row) => (
            <li key={`${row.recipeId}-${row.packagedMealDefId ?? "trad"}`}>
              <article className="hb-meal-rec__card">
                <div>
                  <p className="hb-kicker">
                    {row.recipeType === "traditional"
                      ? "Traditional"
                      : row.recipeType === "meal_kit"
                        ? "Meal kit"
                        : "Recipe base"}
                  </p>
                  <h3 className="hb-item-name">{row.recipeTitle}</h3>
                  {row.productLabel ? (
                    <p className="hb-item-meta">Uses {row.productLabel}</p>
                  ) : null}
                  <p className="hb-item-meta">{row.reason}</p>
                  <div className="hb-meal-rec__flags">
                    {row.allergenStatus === "unverified" ? (
                      <span className="hb-pill hb-pill--warn">
                        Allergens unverified
                      </span>
                    ) : null}
                    {row.allergenStatus === "contains_restricted" ? (
                      <span className="hb-pill hb-pill--danger">
                        Contains restricted allergen
                      </span>
                    ) : null}
                    {!row.instructionsVerified ? (
                      <span className="hb-pill hb-pill--warn">
                        Instructions incomplete
                      </span>
                    ) : null}
                    <span className="hb-pill">
                      {row.missingCount} to buy
                    </span>
                  </div>
                </div>
                <div className="hb-meal-rec__actions">
                  <Link
                    href={`/meals/${row.recipeId}`}
                    className="hb-btn hb-btn--ghost"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    className="hb-btn"
                    disabled={pending || !row.instructionsVerified}
                    onClick={() => addToPlan(row)}
                  >
                    {pending ? "Adding…" : "Add to plan"}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
