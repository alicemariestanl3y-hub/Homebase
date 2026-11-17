"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RecipeListItem } from "@/lib/recipes/types";

type RecipeLibraryProps = {
  recipes: RecipeListItem[];
};

export function RecipeLibrary({ recipes }: RecipeLibraryProps) {
  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (favouritesOnly && !recipe.isFavourite) return false;
      if (!q) return true;
      return (
        recipe.title.toLowerCase().includes(q) ||
        (recipe.cuisine ?? "").toLowerCase().includes(q) ||
        (recipe.cookingMethod ?? "").toLowerCase().includes(q) ||
        recipe.dietaryTags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [recipes, query, favouritesOnly]);

  return (
    <div className="recipe-library">
      <div className="hb-toolbar">
        <input
          className="hb-search"
          type="search"
          placeholder="Search recipes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="hb-check">
          <input
            type="checkbox"
            checked={favouritesOnly}
            onChange={(event) => setFavouritesOnly(event.target.checked)}
          />
          Favourites
        </label>
        <Link href="/meals/new" className="hb-btn">
          Add recipe
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="hb-empty">
          No recipes yet. Add one manually, paste a RecipeTin Eats / blog URL, or
          save a packet-meal variation.
        </p>
      ) : (
        <ul className="recipe-list">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <Link href={`/meals/${recipe.id}`} className="recipe-card">
                <div>
                  <h3 className="recipe-card__title">{recipe.title}</h3>
                  <p className="recipe-card__meta">
                    {recipe.servings} serves
                    {recipe.cuisine ? ` · ${recipe.cuisine}` : ""}
                    {recipe.cookingMethod ? ` · ${recipe.cookingMethod}` : ""}
                    {recipe.prepMinutes != null || recipe.cookMinutes != null
                      ? ` · ${(recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)} min`
                      : ""}
                  </p>
                  <p className="recipe-card__meta">
                    {recipe.ingredientCount} ingredient
                    {recipe.ingredientCount === 1 ? "" : "s"}
                    {recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
                  </p>
                </div>
                <div className="recipe-card__flags">
                  {recipe.isFavourite ? <span className="hb-pill">Favourite</span> : null}
                  {recipe.freezerSuitable ? (
                    <span className="hb-pill">Freezer</span>
                  ) : null}
                  {recipe.leftoverFriendly ? (
                    <span className="hb-pill">Leftovers</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
