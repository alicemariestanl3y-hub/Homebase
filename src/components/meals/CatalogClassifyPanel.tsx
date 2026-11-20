"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { CatalogProduct, ProductKind } from "@/lib/packaged-meals/types";

export function CatalogClassifyPanel() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const response = await fetch("/api/packaged-meals/recommendations");
    const json = (await response.json()) as {
      products?: CatalogProduct[];
      error?: string;
    };
    if (!response.ok) {
      setError(json.error || "Could not load products.");
      return;
    }
    setProducts(
      (json.products ?? []).filter(
        (row) =>
          !row.kindConfirmed &&
          (row.kindSuggested === "recipe_base" ||
            row.kindSuggested === "meal_kit" ||
            row.productKind === "unclassified"),
      ),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  function classify(productId: string, productKind: ProductKind) {
    startTransition(async () => {
      const response = await fetch(`/api/catalog/${productId}/kind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKind }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error || "Could not update classification.");
        return;
      }
      await load();
    });
  }

  if (products.length === 0) return null;

  return (
    <section className="hb-classify" aria-labelledby="classify-heading">
      <h2 id="classify-heading" className="section-title">
        Check packet products
      </h2>
      <p className="hb-item-meta">
        HomeBase suggested these may be recipe bases or kits. Confirm or correct
        before verifying instructions.
      </p>
      {error ? <p className="auth-error">{error}</p> : null}
      <ul className="hb-classify__list">
        {products.slice(0, 8).map((product) => (
          <li key={product.id}>
            <p className="hb-item-name">
              {[product.brand, product.displayName].filter(Boolean).join(" ")}
            </p>
            <p className="hb-item-meta">
              Suggested: {product.kindSuggested ?? "unclassified"}
            </p>
            <div className="hb-classify__actions">
              <button
                type="button"
                className="hb-btn hb-btn--ghost"
                disabled={pending}
                onClick={() => classify(product.id, "recipe_base")}
              >
                Recipe base
              </button>
              <button
                type="button"
                className="hb-btn hb-btn--ghost"
                disabled={pending}
                onClick={() => classify(product.id, "meal_kit")}
              >
                Meal kit
              </button>
              <button
                type="button"
                className="hb-btn hb-btn--ghost"
                disabled={pending}
                onClick={() => classify(product.id, "standard")}
              >
                Just a pantry item
              </button>
              {(product.productKind === "recipe_base" ||
                product.productKind === "meal_kit" ||
                product.kindSuggested === "recipe_base" ||
                product.kindSuggested === "meal_kit") && (
                <Link
                  href={`/meals/packet/new?productId=${product.id}`}
                  className="hb-text-link"
                >
                  Verify packet
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
