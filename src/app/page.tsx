import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { loadInventoryPageData } from "@/lib/inventory/load-page-data";

async function HomePageContent() {
  const state = await loadInventoryPageData();

  const hero = (
    <section className="hb-hero">
      <p className="hb-hero__kicker">— Household food —</p>
      <h1 className="hb-hero__title">Your kitchen at a glance</h1>
      <p className="hb-hero__sub">
        What&apos;s stocked, what needs attention, and what to cook next.
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
          <h2 className="section-title">Couldn&apos;t load household</h2>
          <p className="auth-error">{state.message}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hero={hero}>
      <HomeDashboard
        snapshot={state.snapshot}
        itemsByLocation={state.initialItemsByLocation}
        recentActivity={state.recentActivity}
        mode={state.mode}
        totalItems={state.totalItems}
      />
    </AppShell>
  );
}

function HomeFallback() {
  return (
    <AppShell
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Household food —</p>
          <h1 className="hb-hero__title">Your kitchen at a glance</h1>
          <p className="hb-hero__sub">Loading your household…</p>
        </section>
      }
    >
      <p className="hb-empty">Loading…</p>
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
