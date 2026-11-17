import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/layout/AppShell";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { getRecipe } from "@/lib/recipes/repository";

type PageProps = { params: Promise<{ id: string }> };

async function RecipeDetailContent({ params }: PageProps) {
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
          Back to library
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell showSignOut={mode === "live"}>
      <RecipeDetail recipe={recipe} />
    </AppShell>
  );
}

export default function RecipePage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading recipe…</p>
        </AppShell>
      }
    >
      <RecipeDetailContent {...props} />
    </Suspense>
  );
}
