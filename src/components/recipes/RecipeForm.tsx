"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INVENTORY_UNITS, UNIT_LABELS } from "@/lib/inventory/units";
import type { InventoryUnit } from "@/lib/inventory/types";
import {
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  METHOD_OPTIONS,
  type Recipe,
  type RecipeIngredientInput,
  type RecipeWriteInput,
} from "@/lib/recipes/types";

type RecipeFormProps = {
  initial?: Recipe | null;
  mode: "create" | "edit";
};

function emptyIngredient(): RecipeIngredientInput {
  return { name: "", quantity: null, unit: null, notes: null, optional: false };
}

export function RecipeForm({ initial, mode }: RecipeFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [importUrl, setImportUrl] = useState(initial?.sourceUrl ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourceName, setSourceName] = useState(initial?.sourceName ?? "");
  const [attribution, setAttribution] = useState(initial?.attribution ?? "");
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [scaleTo, setScaleTo] = useState(initial?.servings ?? 4);
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes ?? "");
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes ?? "");
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "");
  const [cookingMethod, setCookingMethod] = useState(
    initial?.cookingMethod ?? "",
  );
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isFavourite, setIsFavourite] = useState(initial?.isFavourite ?? false);
  const [freezerSuitable, setFreezerSuitable] = useState(
    initial?.freezerSuitable ?? false,
  );
  const [leftoverFriendly, setLeftoverFriendly] = useState(
    initial?.leftoverFriendly ?? false,
  );
  const [dietaryTags, setDietaryTags] = useState<string[]>(
    initial?.dietaryTags ?? [],
  );
  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>(
    initial?.ingredients?.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
      optional: item.optional,
    })) ?? [emptyIngredient()],
  );

  function toggleDietary(tag: string) {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag],
    );
  }

  function updateIngredient(
    index: number,
    patch: Partial<RecipeIngredientInput>,
  ) {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function buildPayload(): RecipeWriteInput {
    const factor = servings > 0 ? scaleTo / servings : 1;
    return {
      title,
      sourceUrl,
      sourceName,
      attribution,
      servings: scaleTo,
      prepMinutes: prepMinutes === "" ? null : Number(prepMinutes),
      cookMinutes: cookMinutes === "" ? null : Number(cookMinutes),
      cuisine: cuisine || null,
      cookingMethod: cookingMethod || null,
      instructions,
      notes,
      isFavourite,
      freezerSuitable,
      leftoverFriendly,
      dietaryTags,
      variationOfRecipeId: mode === "create" ? initial?.id ?? null : initial?.variationOfRecipeId ?? null,
      ingredients: ingredients
        .filter((item) => item.name.trim())
        .map((item) => ({
          ...item,
          quantity:
            item.quantity == null
              ? null
              : Math.round(item.quantity * factor * 10) / 10,
        })),
    };
  }

  function importFromUrl() {
    startTransition(async () => {
      setError(null);
      setInfo(null);
      try {
        const response = await fetch("/api/recipes/import-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ url: importUrl }),
        });
        const json = (await response.json()) as {
          recipe?: RecipeWriteInput;
          error?: string;
        };
        if (!response.ok || !json.recipe) {
          setError(json.error || "Could not import that URL.");
          return;
        }
        const recipe = json.recipe;
        setTitle(recipe.title);
        setSourceUrl(recipe.sourceUrl ?? importUrl);
        setSourceName(recipe.sourceName ?? "");
        setAttribution(recipe.attribution ?? "");
        setServings(recipe.servings);
        setScaleTo(recipe.servings);
        setPrepMinutes(recipe.prepMinutes ?? "");
        setCookMinutes(recipe.cookMinutes ?? "");
        setInstructions(recipe.instructions ?? "");
        setIngredients(
          recipe.ingredients.length > 0
            ? recipe.ingredients
            : [emptyIngredient()],
        );
        setInfo(
          "Imported structured recipe data from the page. Check every line — we never invent missing amounts.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        const payload = buildPayload();
        const response = await fetch(
          mode === "edit" && initial
            ? `/api/recipes/${initial.id}`
            : "/api/recipes",
          {
            method: mode === "edit" ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          },
        );
        const json = (await response.json()) as {
          recipe?: Recipe;
          error?: string;
        };
        if (!response.ok || !json.recipe) {
          setError(json.error || "Could not save recipe.");
          return;
        }
        router.push(`/meals/${json.recipe.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  return (
    <form className="recipe-form" onSubmit={onSubmit}>
      {mode === "create" ? (
        <section className="capture-drop">
          <label className="auth-field">
            <span>Import from recipe URL</span>
            <input
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="https://www.recipetineats.com/..."
            />
          </label>
          <p style={{ color: "var(--hb-muted)", fontSize: "0.9rem", margin: 0 }}>
            Works when the site exposes recipe markup (RecipeTin Eats and many
            blogs). Skinnymixers / packet meals without markup: paste manually.
          </p>
          <button
            type="button"
            className="hb-btn hb-btn--ghost"
            disabled={pending || !importUrl.trim()}
            onClick={importFromUrl}
          >
            Fetch recipe
          </button>
        </section>
      ) : null}

      {error ? <p className="auth-error">{error}</p> : null}
      {info ? <p className="auth-success">{info}</p> : null}

      <label className="auth-field">
        <span>Title</span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Chicken pie"
        />
      </label>

      <div className="add-item-form__row">
        <label className="auth-field">
          <span>Base servings</span>
          <input
            type="number"
            min="1"
            step="any"
            required
            value={servings}
            onChange={(event) => {
              const next = Number(event.target.value);
              setServings(next);
              setScaleTo(next);
            }}
          />
        </label>
        <label className="auth-field">
          <span>Scale to</span>
          <input
            type="number"
            min="1"
            step="any"
            required
            value={scaleTo}
            onChange={(event) => setScaleTo(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="add-item-form__row">
        <label className="auth-field">
          <span>Prep (min)</span>
          <input
            type="number"
            min="0"
            value={prepMinutes}
            onChange={(event) => setPrepMinutes(event.target.value)}
          />
        </label>
        <label className="auth-field">
          <span>Cook (min)</span>
          <input
            type="number"
            min="0"
            value={cookMinutes}
            onChange={(event) => setCookMinutes(event.target.value)}
          />
        </label>
      </div>

      <div className="add-item-form__row">
        <label className="auth-field">
          <span>Cuisine</span>
          <select
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value)}
          >
            <option value="">—</option>
            {CUISINE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-field">
          <span>Method</span>
          <select
            value={cookingMethod}
            onChange={(event) => setCookingMethod(event.target.value)}
          >
            <option value="">—</option>
            {METHOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="hb-fieldset">
        <legend>Family flags</legend>
        <label className="hb-check">
          <input
            type="checkbox"
            checked={isFavourite}
            onChange={(event) => setIsFavourite(event.target.checked)}
          />
          Favourite
        </label>
        <label className="hb-check">
          <input
            type="checkbox"
            checked={freezerSuitable}
            onChange={(event) => setFreezerSuitable(event.target.checked)}
          />
          Freezer suitable
        </label>
        <label className="hb-check">
          <input
            type="checkbox"
            checked={leftoverFriendly}
            onChange={(event) => setLeftoverFriendly(event.target.checked)}
          />
          Good leftovers
        </label>
      </fieldset>

      <fieldset className="hb-fieldset">
        <legend>Dietary</legend>
        <div className="hb-chip-row">
          {DIETARY_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`hb-chip${dietaryTags.includes(tag) ? " is-on" : ""}`}
              onClick={() => toggleDietary(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="recipe-ingredients">
        <div className="hb-panel-head">
          <h2>Ingredients</h2>
          <button
            type="button"
            className="hb-btn hb-btn--ghost"
            onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
          >
            Add line
          </button>
        </div>
        {ingredients.map((ingredient, index) => (
          <div key={index} className="recipe-ingredient-row">
            <input
              required={index === 0}
              placeholder="Ingredient"
              value={ingredient.name}
              onChange={(event) =>
                updateIngredient(index, { name: event.target.value })
              }
            />
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Qty"
              value={ingredient.quantity ?? ""}
              onChange={(event) =>
                updateIngredient(index, {
                  quantity:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
            <select
              value={ingredient.unit ?? ""}
              onChange={(event) =>
                updateIngredient(index, {
                  unit: (event.target.value || null) as InventoryUnit | null,
                })
              }
            >
              <option value="">Unit</option>
              {INVENTORY_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <label className="auth-field">
        <span>Method / instructions</span>
        <textarea
          className="hb-textarea"
          rows={6}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </label>

      <label className="auth-field">
        <span>Source URL</span>
        <input
          type="url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
        />
      </label>
      <label className="auth-field">
        <span>Source / attribution</span>
        <input
          value={attribution || sourceName}
          onChange={(event) => {
            setAttribution(event.target.value);
            setSourceName(event.target.value);
          }}
          placeholder="RecipeTin Eats — Nagi Maehashi"
        />
      </label>
      <label className="auth-field">
        <span>Family notes / variation</span>
        <textarea
          className="hb-textarea"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="We use half the chilli; kids skip the olives."
        />
      </label>

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save recipe"}
      </button>
    </form>
  );
}
