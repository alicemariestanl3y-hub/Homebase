import { ACTIVITY_LABELS, LOCATION_LABELS } from "@/lib/inventory/labels";
import { formatQuantity } from "@/lib/inventory/units";
import type { InventoryActivity } from "@/lib/inventory/types";

type ActivityFeedProps = {
  activity: InventoryActivity[];
};

/** Format a stored ISO timestamp for Melbourne display (no "now" dependency). */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  if (activity.length === 0) {
    return (
      <p className="activity-empty">
        No recent activity for this household yet.
      </p>
    );
  }

  return (
    <ol className="activity-list">
      {activity.map((entry) => {
        const signed = formatQuantity(Math.abs(entry.quantityDelta), entry.unit);
        const sign =
          entry.quantityDelta > 0 ? "+" : entry.quantityDelta < 0 ? "−" : "";
        return (
          <li key={entry.id} className="activity-item">
            <div className="activity-item__top">
              <span className={`activity-badge activity-badge--${entry.action}`}>
                {ACTIVITY_LABELS[entry.action]}
              </span>
              <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt)}</time>
            </div>
            <p className="activity-item__body">
              <strong>{entry.itemName}</strong>
              <span>
                {" "}
                {sign}
                {signed} · {LOCATION_LABELS[entry.locationType]}
              </span>
            </p>
            {entry.note ? (
              <p className="activity-item__note">{entry.note}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
