import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/AppShell";
import { MealRecommendations } from "@/components/meals/MealRecommendations";
import { RecipeLibrary } from "@/components/recipes/RecipeLibrary";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { listRecipes } from "@/lib/recipes/repository";

async function MealsContent() {
  await connection();
  const mode = getInventoryMode();
  const household = await resolveHouseholdIdForRequest();

  if (!household.householdId) {
    return (
      <AppShell showSignOut={mode === "live"}>
        <p className="hb-empty">
          {household.error ?? "No household linked to your account yet."}
        </p>
      </AppShell>
    );
  }

  let recipes: Awaited<ReturnType<typeof listRecipes>> = [];
  let error: string | null = null;
  try {
    recipes = await listRecipes(household.householdId);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load recipes.";
  }

  return (
    <AppShell
      showSignOut={mode === "live"}
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Family table —</p>
          <h1 className="hb-hero__title">Meals</h1>
          <p className="hb-hero__sub">
            Packet bases in the pantry first, then your saved recipes.
          </p>
        </section>
      }
    >
      {error ? <p className="auth-error">{error}</p> : null}
      <MealRecommendations />
      <RecipeLibrary recipes={recipes} />
    </AppShell>
  );
}

export default function MealsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading recipes…</p>
        </AppShell>
      }
    >
      <MealsContent />
    </Suspense>
  );
}
