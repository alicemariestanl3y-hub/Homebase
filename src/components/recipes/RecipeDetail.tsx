"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scaleQuantity } from "@/lib/ingredients/matching";
import { formatQuantity } from "@/lib/inventory/units";
import type { Recipe } from "@/lib/recipes/types";

type RecipeDetailProps = {
  recipe: Recipe;
};

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servings);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scaled = useMemo(() => {
    return recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      scaledQuantity: scaleQuantity(
        ingredient.quantity,
        recipe.servings,
        servings,
      ),
    }));
  }, [recipe, servings]);

  function remove() {
    if (!window.confirm(`Delete “${recipe.title}”?`)) return;
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error || "Could not delete.");
        return;
      }
      router.push("/meals");
      router.refresh();
    });
  }

  function saveVariation() {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: `${recipe.title} (family version)`,
          sourceUrl: recipe.sourceUrl,
          sourceName: recipe.sourceName,
          attribution: recipe.attribution,
          servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          cuisine: recipe.cuisine,
          cookingMethod: recipe.cookingMethod,
          instructions: recipe.instructions,
          notes: recipe.notes
            ? `${recipe.notes}\n\nPersonal variation.`
            : "Personal variation.",
          isFavourite: recipe.isFavourite,
          freezerSuitable: recipe.freezerSuitable,
          leftoverFriendly: recipe.leftoverFriendly,
          dietaryTags: recipe.dietaryTags,
          variationOfRecipeId: recipe.id,
          recipeType: recipe.recipeType,
          catalogProductId: recipe.catalogProductId,
          ingredients: scaled.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.scaledQuantity,
            unit: ingredient.unit,
            notes: ingredient.notes,
            optional: ingredient.optional,
          })),
        }),
      });
      const json = (await response.json()) as {
        recipe?: Recipe;
        error?: string;
      };
      if (!response.ok || !json.recipe) {
        setError(json.error || "Could not save variation.");
        return;
      }
      router.push(`/meals/${json.recipe.id}/edit`);
      router.refresh();
    });
  }

  return (
    <article className="recipe-detail">
      <p className="hb-kicker">Recipe</p>
      <h1 className="section-title">{recipe.title}</h1>
      <p className="recipe-card__meta">
        {recipe.cuisine || "Uncategorised"}
        {recipe.cookingMethod ? ` · ${recipe.cookingMethod}` : ""}
        {recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
      </p>

      <div className="recipe-card__flags" style={{ margin: "0.75rem 0" }}>
        {recipe.recipeType === "recipe_base" ? (
          <span className="hb-pill">Recipe base</span>
        ) : null}
        {recipe.recipeType === "meal_kit" ? (
          <span className="hb-pill">Meal kit</span>
        ) : null}
        {recipe.isFavourite ? <span className="hb-pill">Favourite</span> : null}
        {recipe.freezerSuitable ? <span className="hb-pill">Freezer</span> : null}
        {recipe.leftoverFriendly ? (
          <span className="hb-pill">Leftovers</span>
        ) : null}
        {recipe.dietaryTags.map((tag) => (
          <span key={tag} className="hb-pill">
            {tag}
          </span>
        ))}
      </div>

      {recipe.attribution || recipe.sourceUrl ? (
        <p className="inventory-demo-note">
          {recipe.attribution || "Source"}
          {recipe.sourceUrl ? (
            <>
              {" · "}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                Original link
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <label className="auth-field" style={{ maxWidth: "8rem" }}>
        <span>Servings</span>
        <input
          type="number"
          min="1"
          step="any"
          value={servings}
          onChange={(event) => setServings(Number(event.target.value))}
        />
      </label>

      <h2 className="section-title">Ingredients</h2>
      <ul className="hb-inventory-list">
        {scaled.map((ingredient) => (
          <li key={ingredient.id} className="hb-item-row">
            <div>
              <h3 className="hb-item-name">{ingredient.name}</h3>
              <p className="hb-item-meta">
                {ingredient.scaledQuantity != null && ingredient.unit
                  ? formatQuantity(ingredient.scaledQuantity, ingredient.unit)
                  : ingredient.scaledQuantity != null
                    ? String(ingredient.scaledQuantity)
                    : "Quantity not specified"}
                {ingredient.optional ? " · optional" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {recipe.instructions ? (
        <>
          <h2 className="section-title">Method</h2>
          <pre className="recipe-instructions">{recipe.instructions}</pre>
        </>
      ) : null}

      {recipe.notes ? (
        <>
          <h2 className="section-title">Family notes</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{recipe.notes}</p>
        </>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}

      <div className="inventory-row__actions" style={{ marginTop: "1.25rem" }}>
        <Link href={`/meals/${recipe.id}/edit`} className="hb-btn">
          Edit
        </Link>
        <button
          type="button"
          className="hb-btn hb-btn--ghost"
          disabled={pending}
          onClick={saveVariation}
        >
          Save my variation
        </button>
        <button
          type="button"
          className="hb-btn hb-btn--ghost"
          disabled={pending}
          onClick={remove}
        >
          Delete
        </button>
        <Link href="/meals" className="hb-btn hb-btn--ghost">
          Library
        </Link>
      </div>
    </article>
  );
}
