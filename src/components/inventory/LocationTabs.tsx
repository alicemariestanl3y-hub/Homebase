"use client";

import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import type { LocationType } from "@/lib/inventory/types";

type LocationTabsProps = {
  active: LocationType;
  counts: Record<LocationType, number>;
  onChange: (location: LocationType) => void;
};

/**
 * Segmented location switcher — the primary navigation for inventory.
 * Kept as a client component because tab state is interactive.
 */
export function LocationTabs({ active, counts, onChange }: LocationTabsProps) {
  return (
    <div
      className="location-tabs"
      role="tablist"
      aria-label="Storage location"
    >
      {LOCATION_ORDER.map((location) => {
        const isActive = location === active;
        return (
          <button
            key={location}
            type="button"
            role="tab"
            id={`tab-${location}`}
            aria-selected={isActive}
            aria-controls={`panel-${location}`}
            className={`location-tab${isActive ? " is-active" : ""}`}
            onClick={() => onChange(location)}
          >
            <span className="location-tab__label">{LOCATION_LABELS[location]}</span>
            <span className="location-tab__count" aria-hidden="true">
              {counts[location]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
