"use client";

import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import type { LocationType } from "@/lib/inventory/types";

type LocationTabsProps = {
  active: LocationType;
  counts: Record<LocationType, number>;
  onChange: (location: LocationType) => void;
};

const ICONS: Record<LocationType, string> = {
  pantry: "Jar",
  fridge: "Cold",
  freezer: "Ice",
};

export function LocationTabs({ active, counts, onChange }: LocationTabsProps) {
  return (
    <div className="hb-location-tabs" role="tablist" aria-label="Storage location">
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
            className={`hb-location-tab${isActive ? " is-active" : ""}`}
            onClick={() => onChange(location)}
          >
            <LocationGlyph type={location} />
            <span className="hb-location-tab__label">{LOCATION_LABELS[location]}</span>
            <span className="hb-location-tab__count">{counts[location]}</span>
            <span className="sr-only">{ICONS[location]}</span>
          </button>
        );
      })}
    </div>
  );
}

function LocationGlyph({ type }: { type: LocationType }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  if (type === "pantry") {
    return (
      <svg {...props}>
        <path d="M8 4h8v3H8V4Zm1 3h6v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (type === "fridge") {
    return (
      <svg {...props}>
        <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6 11h12M15 7v2M15 14v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M12 4 5 10.5h3V20h8v-9.5h3L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 14.5h5M12 12v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
