"use client";

import { useMemo, useState } from "react";
import { LOCATION_ORDER } from "@/lib/inventory/labels";
import type {
  InventoryActivity,
  InventoryItemView,
  InventoryMode,
  InventorySnapshot,
  LocationType,
} from "@/lib/inventory/types";
import { ActivityFeed } from "./ActivityFeed";
import { AddItemForm } from "./AddItemForm";
import { InventoryItemRow } from "./InventoryItemRow";
import { LocationTabs } from "./LocationTabs";
import { SignOutButton } from "./SignOutButton";

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  initialItemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
  showSignOut: boolean;
};

/**
 * Client shell for tab switching. Data is loaded on the server and passed in,
 * so the first paint already has inventory — we only hydrate interactivity.
 */
export function InventoryView({
  snapshot,
  initialItemsByLocation,
  recentActivity,
  mode,
  showSignOut,
}: InventoryViewProps) {
  const [active, setActive] = useState<LocationType>("fridge");

  const counts = useMemo(() => {
    return LOCATION_ORDER.reduce(
      (acc, location) => {
        acc[location] = initialItemsByLocation[location].length;
        return acc;
      },
      { pantry: 0, fridge: 0, freezer: 0 } as Record<LocationType, number>,
    );
  }, [initialItemsByLocation]);

  const items = initialItemsByLocation[active];

  return (
    <div className="inventory-shell">
      <header className="inventory-hero">
        <div className="inventory-hero__top">
          <p className="inventory-kicker">Household food</p>
          {showSignOut ? <SignOutButton /> : null}
        </div>
        <h1 className="inventory-brand">HomeBase</h1>
        <p className="inventory-tagline">
          What&apos;s in the {snapshot.household.name.toLowerCase()} — pantry,
          fridge and freezer in one place.
        </p>
        <p className="inventory-demo-note">
          {mode === "demo"
            ? "Sample data · Supabase not connected yet"
            : "Live household inventory · secured by Supabase Auth + RLS"}
        </p>
      </header>

      <LocationTabs active={active} counts={counts} onChange={setActive} />

      <section
        className="inventory-panel"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        <div className="inventory-panel__heading">
          <h2>
            {items.length} item{items.length === 1 ? "" : "s"}
          </h2>
          <p>Sorted so soon-to-expire ingredients surface first.</p>
        </div>

        {items.length === 0 ? (
          <p className="inventory-empty">
            Nothing stored here yet. Add your first item below.
          </p>
        ) : (
          <ul className="inventory-list">
            {items.map((item, index) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                index={index}
                locationType={active}
              />
            ))}
          </ul>
        )}
      </section>

      <AddItemForm activeLocation={active} />

      <section className="activity-section" aria-labelledby="activity-heading">
        <div className="inventory-panel__heading">
          <h2 id="activity-heading">Recent activity</h2>
          <p>
            Adds, uses and adjustments — the trail a future agent will also
            write to.
          </p>
        </div>
        <ActivityFeed activity={recentActivity} />
      </section>
    </div>
  );
}
