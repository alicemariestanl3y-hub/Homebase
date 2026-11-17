import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/AppShell";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { getRecipe } from "@/lib/recipes/repository";

type PageProps = { params: Promise<{ id: string }> };

async function EditContent({ params }: PageProps) {
  await connection();
  const { id } = await params;
  const mode = getInventoryMode();
  const household = await resolveHouseholdIdForRequest();
  if (!household.householdId) {
    return (
      <AppShell showSignOut={mode === "live"}>
        <p className="hb-empty">{household.error ?? "No household."}</p>
      </AppShell>
    );
  }
  const recipe = await getRecipe(household.householdId, id);
  if (!recipe) {
    return (
      <AppShell showSignOut={mode === "live"}>
        <p className="hb-empty">Recipe not found.</p>
        <Link href="/meals" className="hb-btn hb-btn--ghost">
          Back
        </Link>
      </AppShell>
    );
  }
  return (
    <AppShell
      showSignOut={mode === "live"}
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Family table —</p>
          <h1 className="hb-hero__title">Edit recipe</h1>
          <p className="hb-hero__sub">Scale servings and keep your family notes.</p>
        </section>
      }
    >
      <RecipeForm mode="edit" initial={recipe} />
    </AppShell>
  );
}

export default function EditRecipePage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading…</p>
        </AppShell>
      }
    >
      <EditContent {...props} />
    </Suspense>
  );
}
