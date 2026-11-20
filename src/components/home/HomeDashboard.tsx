import Link from "next/link";
import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/inventory/labels";
import type {
  InventoryActivity,
  InventoryItemView,
  InventoryMode,
  InventorySnapshot,
  LocationType,
} from "@/lib/inventory/types";
import { ActivityFeed } from "@/components/inventory/ActivityFeed";

type HomeDashboardProps = {
  snapshot: InventorySnapshot;
  itemsByLocation: Record<LocationType, InventoryItemView[]>;
  recentActivity: InventoryActivity[];
  mode: InventoryMode;
  totalItems: number;
};

type SoonRow = InventoryItemView & { locationType: LocationType };

export function HomeDashboard({
  snapshot,
  itemsByLocation,
  recentActivity,
  mode,
  totalItems,
}: HomeDashboardProps) {
  const soonItems: SoonRow[] = LOCATION_ORDER.flatMap((loc) =>
    itemsByLocation[loc]
      .filter((item) => item.urgency === "soon" || item.urgency === "expired")
      .map((item) => ({ ...item, locationType: loc })),
  )
    .sort((a, b) => {
      if (a.urgency === "expired" && b.urgency !== "expired") return -1;
      if (b.urgency === "expired" && a.urgency !== "expired") return 1;
      const aDays = a.expiresOn ? Date.parse(a.expiresOn) : Number.MAX_SAFE_INTEGER;
      const bDays = b.expiresOn ? Date.parse(b.expiresOn) : Number.MAX_SAFE_INTEGER;
      return aDays - bDays;
    })
    .slice(0, 5);

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

      <section className="hb-dash-summary" aria-label="Household summary">
        <div className="hb-dash-stat">
          <p className="hb-dash-stat__value">{totalItems}</p>
          <p className="hb-dash-stat__label">Items tracked</p>
        </div>
        <div className="hb-dash-locations">
          {LOCATION_ORDER.map((location) => (
            <Link
              key={location}
              href={`/inventory?loc=${location}`}
              className="hb-dash-loc"
            >
              <span className="hb-dash-loc__count">
                {itemsByLocation[location].length}
              </span>
              <span className="hb-dash-loc__label">
                {LOCATION_LABELS[location]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="hb-dash-section" aria-labelledby="soon-heading">
        <div className="hb-panel-head">
          <h2 id="soon-heading">Needs attention</h2>
          <Link href="/inventory" className="hb-text-link">
            View all
          </Link>
        </div>
        {soonItems.length === 0 ? (
          <p className="hb-empty">Nothing expiring soon. Nice work.</p>
        ) : (
          <ul className="hb-dash-soon">
            {soonItems.map((item) => (
              <li key={item.id} className="hb-dash-soon__row">
                <div>
                  <p className="hb-item-name">{item.name}</p>
                  <p className={`hb-item-meta hb-item-meta--${item.urgency}`}>
                    {item.expiryLabel ?? "Check date"}
                    <span className="hb-pill">
                      {LOCATION_LABELS[item.locationType]}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hb-dash-section" aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="section-title">
          Quick actions
        </h2>
        <div className="hb-dash-actions">
          <Link href="/inventory" className="hb-btn hb-btn--ghost">
            Browse inventory
          </Link>
          <Link href="/capture" className="hb-btn hb-btn--ghost">
            Photograph shelves
          </Link>
          <Link href="/grocery" className="hb-btn hb-btn--ghost">
            Import grocery order
          </Link>
          <Link href="/meals" className="hb-btn hb-btn--ghost">
            Meal recipes
          </Link>
        </div>
      </section>

      <section className="activity-section" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="section-title">
          Recent activity
        </h2>
        <ActivityFeed activity={recentActivity} />
      </section>
    </>
  );
}
