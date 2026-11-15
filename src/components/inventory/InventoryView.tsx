"use client";

import Link from "next/link";
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

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  initialItemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
};

export function InventoryView({
  snapshot,
  initialItemsByLocation,
  recentActivity,
  mode,
}: InventoryViewProps) {
  const [active, setActive] = useState<LocationType>("fridge");
  const [showManualAdd, setShowManualAdd] = useState(false);

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
    <>
      {mode === "demo" ? (
        <p className="demo-banner">Sample data · connect Supabase for live inventory</p>
      ) : null}

      <p className="hb-kicker" style={{ marginBottom: "0.35rem" }}>
        {snapshot.household.name}
      </p>

      <LocationTabs active={active} counts={counts} onChange={setActive} />

      <section
        className="inventory-panel"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        <div className="hb-panel-head">
          <h2>
            {items.length} item{items.length === 1 ? "" : "s"}
          </h2>
          <p className="hb-panel-meta">Soonest to expire</p>
        </div>

        {items.length === 0 ? (
          <p className="hb-empty">
            Nothing here yet. Capture a shelf photo or add an item manually.
          </p>
        ) : (
          <ul className="hb-inventory-list">
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

      <div className="manual-add">
        <button
          type="button"
          className="hb-btn hb-btn--ghost"
          onClick={() => setShowManualAdd((value) => !value)}
        >
          {showManualAdd ? "Hide manual add" : "Add item manually"}
        </button>
        {showManualAdd ? <AddItemForm activeLocation={active} /> : null}
      </div>

      <section className="activity-section" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="section-title">
          Recent activity
        </h2>
        <ActivityFeed activity={recentActivity} />
      </section>

      <Link href="/capture" className="hb-fab" aria-label="Add items with camera">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </Link>
    </>
  );
}
