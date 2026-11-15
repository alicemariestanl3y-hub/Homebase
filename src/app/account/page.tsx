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
    <AppShell showSignOut={mode === "live"}>
      <p className="hb-kicker">Account</p>
      <h1 className="section-title" style={{ marginTop: "0.35rem" }}>
        HomeBase settings
      </h1>
      <p style={{ color: "var(--hb-muted)", lineHeight: 1.45 }}>
        Mode: {mode === "live" ? "Live Supabase household" : "Demo sample data"}
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "1rem",
        }}
      >
        <Link href="/capture" className="hb-btn" style={{ textAlign: "center" }}>
          Smart Inventory Capture
        </Link>
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
