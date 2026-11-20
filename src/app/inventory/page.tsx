import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { InventoryView } from "@/components/inventory/InventoryView";
import { loadInventoryPageData } from "@/lib/inventory/load-page-data";
import type { LocationType } from "@/lib/inventory/types";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseLocation(value: string | undefined): LocationType | undefined {
  if (value === "pantry" || value === "fridge" || value === "freezer") {
    return value;
  }
  return undefined;
}

async function InventoryPageContent({ searchParams }: InventoryPageProps) {
  const params = (await searchParams) ?? {};
  const addOpen = firstParam(params.add) === "1";
  const initialLocation = parseLocation(firstParam(params.loc));
  const state = await loadInventoryPageData();

  const hero = (
    <section className="hb-hero">
      <p className="hb-hero__kicker">— Inventory —</p>
      <h1 className="hb-hero__title">What&apos;s in the kitchen</h1>
      <p className="hb-hero__sub">
        Search pantry, fridge and freezer in one place.
      </p>
    </section>
  );

  if (state.kind === "no-household") {
    return (
      <AppShell hero={hero}>
        <p className="hb-empty">
          No household is linked to your account yet. Sign out and sign up
          again, or check that the Supabase migration ran.
        </p>
      </AppShell>
    );
  }

  if (state.kind === "no-snapshot") {
    return (
      <AppShell hero={hero}>
        <p className="hb-empty">No household inventory found.</p>
      </AppShell>
    );
  }

  if (state.kind === "error") {
    return (
      <AppShell hero={hero}>
        <div className="auth-card" style={{ boxShadow: "none" }}>
          <h2 className="section-title">Couldn&apos;t load inventory</h2>
          <p className="auth-error">{state.message}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hero={hero}>
      <InventoryView
        snapshot={state.snapshot}
        initialItemsByLocation={state.initialItemsByLocation}
        recentActivity={state.recentActivity}
        mode={state.mode}
        initialShowManualAdd={addOpen}
        initialLocation={initialLocation}
      />
    </AppShell>
  );
}

function InventoryFallback() {
  return (
    <AppShell
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Inventory —</p>
          <h1 className="hb-hero__title">What&apos;s in the kitchen</h1>
          <p className="hb-hero__sub">Loading your inventory…</p>
        </section>
      }
    >
      <p className="hb-empty">Loading…</p>
    </AppShell>
  );
}

export default function InventoryPage(props: InventoryPageProps) {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}
