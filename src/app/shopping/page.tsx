import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { getDemoShoppingLines } from "@/lib/packaged-meals/shopping-store";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatQuantity } from "@/lib/inventory/units";
import type { InventoryUnit } from "@/lib/inventory/types";

type ShoppingRow = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  isChecked?: boolean;
};

async function ShoppingContent() {
  await connection();
  const mode = getInventoryMode();
  const household = await resolveHouseholdIdForRequest();

  if (!household.householdId) {
    return (
      <AppShell>
        <p className="hb-empty">
          {household.error ?? "No household linked yet."}
        </p>
      </AppShell>
    );
  }

  let items: ShoppingRow[] = [];
  let error: string | null = null;

  try {
    if (!isSupabaseConfigured()) {
      items = getDemoShoppingLines(household.householdId).map((row) => ({
        ...row,
        notes: row.notes,
        isChecked: false,
      }));
    } else {
      const supabase = await createClient();
      const { data: list } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("household_id", household.householdId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (list?.id) {
        const { data, error: itemsError } = await supabase
          .from("shopping_list_items")
          .select("id, name, quantity, unit, notes, is_checked")
          .eq("shopping_list_id", list.id)
          .order("sort_order");
        if (itemsError) throw itemsError;
        items = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          quantity: row.quantity == null ? null : Number(row.quantity),
          unit: (row.unit as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
          isChecked: Boolean(row.is_checked),
        }));
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load shopping list.";
  }

  return (
    <AppShell
      showSignOut={mode === "live"}
      hero={
        <section className="hb-hero">
          <p className="hb-hero__kicker">— Shopping —</p>
          <h1 className="hb-hero__title">Shopping list</h1>
          <p className="hb-hero__sub">
            Built from meal plans — packet contents stay off the list.
          </p>
        </section>
      }
    >
      {error ? <p className="auth-error">{error}</p> : null}
      {items.length === 0 ? (
        <p className="hb-empty">
          No open shopping items yet. From Meals, add a recommended packet meal
          to this week’s plan.
        </p>
      ) : (
        <ul className="hb-inventory-list">
          {items.map((item) => (
            <li key={item.id} className="hb-item-card">
              <div className="hb-item-card__body">
                <h3 className="hb-item-name">{item.name}</h3>
                <p className="hb-item-meta">
                  {item.quantity != null && item.unit
                    ? formatQuantity(
                        item.quantity,
                        item.unit as InventoryUnit,
                      )
                    : item.quantity != null
                      ? String(item.quantity)
                      : "Quantity as needed"}
                  {item.notes ? ` · ${item.notes}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/meals" className="hb-btn hb-btn--ghost" style={{ marginTop: "1rem" }}>
        Back to meals
      </Link>
    </AppShell>
  );
}

export default function ShoppingPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading shopping list…</p>
        </AppShell>
      }
    >
      <ShoppingContent />
    </Suspense>
  );
}
