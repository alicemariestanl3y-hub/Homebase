import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SignOutButton } from "@/components/inventory/SignOutButton";
import { getInventoryMode } from "@/lib/inventory/get-repository";

async function AccountContent() {
  await connection();
  const mode = getInventoryMode();

  return (
    <AppShell>
      <p className="hb-kicker">Account</p>
      <h1 className="section-title" style={{ marginTop: "0.35rem" }}>
        HomeBase settings
      </h1>
      <p style={{ color: "var(--hb-muted)", lineHeight: 1.45 }}>
        Mode: {mode === "live" ? "Live Supabase household" : "Demo sample data"}
      </p>
      <nav className="hb-account-nav" aria-label="Secondary">
        <Link href="/inventory" className="hb-account-nav__link">
          Inventory
        </Link>
        <Link href="/capture" className="hb-account-nav__link">
          Photograph shelves
        </Link>
        <Link href="/grocery" className="hb-account-nav__link">
          Import grocery order
        </Link>
        <Link href="/meals" className="hb-account-nav__link">
          Meals &amp; recipes
        </Link>
        <Link href="/insights" className="hb-account-nav__link">
          Insights
        </Link>
        <Link href="/shopping" className="hb-account-nav__link">
          Shopping list
        </Link>
      </nav>
      <div className="hb-account-actions">
        {mode === "live" ? <SignOutButton /> : null}
        {mode !== "live" ? (
          <Link
            href="/login"
            className="hb-btn hb-btn--ghost"
            style={{ textAlign: "center" }}
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading…</p>
        </AppShell>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
