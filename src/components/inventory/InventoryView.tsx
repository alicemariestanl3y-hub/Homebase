"use client";

import { useEffect, useMemo, useState } from "react";
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
  /** Open manual add from Add action sheet (?add=1). */
  initialShowManualAdd?: boolean;
  /** Deep-link location from home dashboard (?loc=). */
  initialLocation?: LocationType;
};

function isLocationType(value: string | undefined): value is LocationType {
  return value === "pantry" || value === "fridge" || value === "freezer";
}

export function InventoryView({
  snapshot,
  initialItemsByLocation,
  recentActivity,
  mode,
  initialShowManualAdd = false,
  initialLocation,
}: InventoryViewProps) {
  const [active, setActive] = useState<LocationType>(
    isLocationType(initialLocation) ? initialLocation : "fridge",
  );
  const [showManualAdd, setShowManualAdd] = useState(initialShowManualAdd);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") setShowManualAdd(true);
    const loc = params.get("loc") ?? undefined;
    if (isLocationType(loc)) setActive(loc);
  }, []);

  const counts = useMemo(() => {
    return LOCATION_ORDER.reduce(
      (acc, location) => {
        acc[location] = initialItemsByLocation[location].length;
        return acc;
      },
      { pantry: 0, fridge: 0, freezer: 0 } as Record<LocationType, number>,
    );
  }, [initialItemsByLocation]);

  const filtered = useMemo(() => {
    const items = initialItemsByLocation[active];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.notes?.toLowerCase().includes(q) ?? false),
    );
  }, [active, initialItemsByLocation, query]);

  return (
    <>
      {mode === "demo" ? (
        <p className="demo-banner">
          Sample data · connect Supabase for live inventory
        </p>
      ) : null}

      <p className="hb-kicker" style={{ marginBottom: "0.35rem" }}>
        {snapshot.household.name}
      </p>

      <LocationTabs active={active} counts={counts} onChange={setActive} />

      <label className="hb-search">
        <span className="sr-only">Search inventory</span>
        <input
          type="search"
          className="hb-search__input"
          placeholder="Search items…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <section
        className="inventory-panel"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        <div className="hb-panel-head">
          <h2>
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {query.trim() ? " found" : ""}
          </h2>
          <p className="hb-panel-meta">Soonest to expire</p>
        </div>

        {filtered.length === 0 ? (
          <p className="hb-empty">
            {query.trim()
              ? "No items match your search in this location."
              : "Nothing here yet. Use Add to photograph shelves, import a grocery order, or add an item manually."}
          </p>
        ) : (
          <ul className="hb-inventory-list">
            {filtered.map((item, index) => (
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
    </>
  );
}
