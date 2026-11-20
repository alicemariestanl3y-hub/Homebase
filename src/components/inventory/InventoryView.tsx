"use client";

import { useEffect, useMemo, useState } from "react";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import { matchesProductQuery } from "@/lib/inventory/product-names";
import type {
  InventoryActivity,
  InventoryItemView,
  InventoryMode,
  InventorySnapshot,
  LocationType,
} from "@/lib/inventory/types";
import { CatalogClassifyPanel } from "@/components/meals/CatalogClassifyPanel";
import { ActivityFeed } from "./ActivityFeed";
import { AddItemForm } from "./AddItemForm";
import { InventoryItemRow } from "./InventoryItemRow";

type InventoryViewProps = {
  snapshot: InventorySnapshot;
  initialItemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
  initialShowManualAdd?: boolean;
  initialLocation?: LocationType;
};

type LocationFilter = "all" | LocationType;

type FlatItem = InventoryItemView & { locationType: LocationType };

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
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(
    initialLocation ?? "all",
  );
  const [showManualAdd, setShowManualAdd] = useState(initialShowManualAdd);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") setShowManualAdd(true);
    const loc = params.get("loc") ?? undefined;
    if (isLocationType(loc)) setLocationFilter(loc);
  }, []);

  const allItems = useMemo(() => {
    const rows: FlatItem[] = [];
    for (const location of LOCATION_ORDER) {
      for (const item of initialItemsByLocation[location]) {
        rows.push({ ...item, locationType: location });
      }
    }
    return rows.sort((a, b) => {
      const urgencyRank = { expired: 0, soon: 1, ok: 2, none: 3 } as const;
      const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
  }, [initialItemsByLocation]);

  const counts = useMemo(() => {
    const base = {
      all: allItems.length,
      pantry: 0,
      fridge: 0,
      freezer: 0,
    };
    for (const item of allItems) {
      base[item.locationType] += 1;
    }
    return base;
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (locationFilter !== "all" && item.locationType !== locationFilter) {
        return false;
      }
      return matchesProductQuery(item.name, item.notes, query);
    });
  }, [allItems, locationFilter, query]);

  const addLocation: LocationType =
    locationFilter === "all" ? "fridge" : locationFilter;

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

      <CatalogClassifyPanel />

      <label className="hb-search hb-search--prominent">
        <span className="sr-only">Search inventory</span>
        <input
          type="search"
          className="hb-search__input"
          placeholder="Search all food…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={false}
        />
      </label>

      <div
        className="hb-filter-chips"
        role="tablist"
        aria-label="Filter by location"
      >
        <FilterChip
          label="All"
          count={counts.all}
          active={locationFilter === "all"}
          onSelect={() => setLocationFilter("all")}
        />
        {LOCATION_ORDER.map((location) => (
          <FilterChip
            key={location}
            label={LOCATION_LABELS[location]}
            count={counts[location]}
            active={locationFilter === location}
            onSelect={() => setLocationFilter(location)}
          />
        ))}
      </div>

      <section className="inventory-panel" aria-live="polite">
        <div className="hb-panel-head">
          <h2>
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
            {query.trim() ? " found" : ""}
          </h2>
          <p className="hb-panel-meta">
            {locationFilter === "all"
              ? "All locations"
              : LOCATION_LABELS[locationFilter]}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="hb-empty hb-empty--card">
            {query.trim() ? (
              <>
                <p className="hb-empty__title">No matches</p>
                <p>
                  Nothing matched “{query.trim()}”
                  {locationFilter === "all"
                    ? ""
                    : ` in ${LOCATION_LABELS[locationFilter]}`}
                  . Try another name, or clear the search.
                </p>
                <button
                  type="button"
                  className="hb-btn hb-btn--ghost"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="hb-empty__title">No items here yet</p>
                <p>
                  Use Add to photograph shelves, import a grocery order, or add
                  an item manually.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="hb-inventory-list">
            {filtered.map((item, index) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                index={index}
                locationType={item.locationType}
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
        {showManualAdd ? <AddItemForm activeLocation={addLocation} /> : null}
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

function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`hb-filter-chip${active ? " is-active" : ""}`}
      onClick={onSelect}
    >
      <span>{label}</span>
      <span className="hb-filter-chip__count">{count}</span>
    </button>
  );
}
