import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/AppShell";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { getInventoryMode } from "@/lib/inventory/get-repository";

async function NewRecipeContent() {
  await connection();
  const mode = getInventoryMode();
  return (
    <AppShell
      showSignOut={mode === "live"}
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Family table —</p>
          <h1 className="hb-hero__title">Add a recipe</h1>
          <p className="hb-hero__sub">
            Paste a URL when the site shares recipe data, or enter it yourself.
          </p>
        </section>
      }
    >
      <RecipeForm mode="create" />
    </AppShell>
  );
}

export default function NewRecipePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading…</p>
        </AppShell>
      }
    >
      <NewRecipeContent />
    </Suspense>
  );
}
