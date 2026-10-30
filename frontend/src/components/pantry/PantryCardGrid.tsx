import { EllipsisVertical, Trash2 } from "lucide-react";
import { expiryCopy, getPantryStatus, pantryStatusLabel } from "../../features/pantry/pantry.logic";
import type { PantryItem } from "../../types";
import { foodUnitLabel } from "../../utils/units";
import CategoryIcon from "./CategoryIcon";

type PantryCardGridProps = {
  items: PantryItem[];
  focusedItemId: string | null;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
};

export default function PantryCardGrid({ items, focusedItemId, onEdit, onDelete }: PantryCardGridProps) {
  return <div className="pantry-card-grid">{items.map((item) => {
    const itemStatus = getPantryStatus(item);
    const expiry = expiryCopy(item);
    const cardClass = `pantry-item-card${focusedItemId === item.id ? " notification-target" : ""}`;
    return <article id={`pantry-item-${item.id}`} className={cardClass} key={item.id}>
      <header>
        <span aria-hidden="true"><CategoryIcon category={item.category} /></span>
        <div className="pantry-row-actions">
          <button onClick={() => onEdit(item)} aria-label={`Sửa ${item.name}`} title="Sửa thực phẩm"><EllipsisVertical /></button>
          <button className="danger" onClick={() => onDelete(item)} aria-label={`Xóa ${item.name}`}><Trash2 /></button>
        </div>
      </header>
      <small>{item.category}</small>
      <h3>{item.name}</h3>
      <b>{item.quantity} {foodUnitLabel[item.unit]}</b>
      <footer><span className={`pantry-status ${itemStatus}`}>{pantryStatusLabel(itemStatus)}</span><em>{expiry.relative}</em></footer>
    </article>;
  })}</div>;
}
