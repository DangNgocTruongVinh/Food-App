import { EllipsisVertical, Trash2 } from "lucide-react";
import { expiryCopy, getPantryStatus, pantryStatusLabel, storageLabel } from "../../features/pantry/pantry.logic";
import type { PantryItem } from "../../types";
import { foodUnitLabel } from "../../utils/units";
import CategoryIcon from "./CategoryIcon";

type PantryTableProps = {
  items: PantryItem[];
  focusedItemId: string | null;
  deleting: boolean;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
};

export default function PantryTable({ items, focusedItemId, deleting, onEdit, onDelete }: PantryTableProps) {
  return <div className="pantry-table-wrap">
    <div className="pantry-table pantry-table-head">
      <span>Thực phẩm</span><span>Danh mục</span><span>Số lượng</span><span>Hạn sử dụng</span>
      <span>Nơi bảo quản</span><span>Tình trạng</span><span />
    </div>
    {items.map((item) => {
      const itemStatus = getPantryStatus(item);
      const expiry = expiryCopy(item);
      const rowClass = `pantry-table pantry-table-row${focusedItemId === item.id ? " notification-target" : ""}`;
      return <article id={`pantry-item-${item.id}`} className={rowClass} key={item.id}>
        <div className="pantry-food-name"><span aria-hidden="true"><CategoryIcon category={item.category} /></span><strong>{item.name}</strong></div>
        <span data-label="Danh mục">{item.category}</span>
        <strong data-label="Số lượng">{item.quantity} {foodUnitLabel[item.unit]}</strong>
        <div className={`pantry-expiry ${itemStatus}`} data-label="Hạn sử dụng"><span>{expiry.date}</span><small>{expiry.relative}</small></div>
        <span data-label="Nơi bảo quản">{storageLabel[item.storageLocation]}</span>
        <span data-label="Tình trạng" className={`pantry-status ${itemStatus}`}>{pantryStatusLabel(itemStatus)}</span>
        <div className="pantry-row-actions">
          <button onClick={() => onEdit(item)} aria-label={`Sửa ${item.name}`} title="Sửa thực phẩm"><EllipsisVertical /></button>
          <button className="danger" disabled={deleting} onClick={() => onDelete(item)} aria-label={`Xóa ${item.name}`} title="Xóa thực phẩm">
            <Trash2 />
          </button>
        </div>
      </article>;
    })}
  </div>;
}
