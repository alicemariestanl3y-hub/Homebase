import { formatQuantity } from "@/lib/inventory/units";
import type { InventoryItemView } from "@/lib/inventory/types";

type InventoryItemRowProps = {
  item: InventoryItemView;
  index: number;
};

export function InventoryItemRow({ item, index }: InventoryItemRowProps) {
  return (
    <li
      className={`inventory-row inventory-row--${item.urgency}`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="inventory-row__main">
        <h3 className="inventory-row__name">{item.name}</h3>
        <p className="inventory-row__qty">
          {formatQuantity(item.quantity, item.unit)}
        </p>
      </div>
      {item.expiryLabel ? (
        <p
          className={`inventory-row__expiry inventory-row__expiry--${item.urgency}`}
        >
          {item.expiryLabel}
        </p>
      ) : null}
      {item.notes ? <p className="inventory-row__notes">{item.notes}</p> : null}
    </li>
  );
}
