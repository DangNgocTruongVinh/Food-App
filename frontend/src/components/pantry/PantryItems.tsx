import { Pencil, Trash2 } from "lucide-react";
import {
  expiryCopy, formatPantryQuantity, getPantryStatus, pantryStatusLabel, stockWarning, storageLabel, type PantryItemStatus,
} from "../../features/pantry/pantry.logic";
import { pantryItemElementId } from "../../features/pantry/usePantryItemFocus";
import { cx } from "../../features/ui/ui.logic";
import type { PantryItem } from "../../types";
import { IconButton } from "../ui";

type PantryItemsProps = {
  items: PantryItem[];
  focusedItemId: string | null;
  deletingId: string | null;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
};

export function PantryStatusTag({ status }: { status: PantryItemStatus }) {
  return <span className={`kho-status kho-status--${status}`}>{pantryStatusLabel(status)}</span>;
}

function ItemActions({ item, deleting, onEdit, onDelete }: { item: PantryItem; deleting: boolean } & Pick<PantryItemsProps, "onEdit" | "onDelete">) {
  return (
    <div className="kho-actions">
      <IconButton label={`Sửa ${item.name}`} icon={<Pencil />} quiet onClick={() => onEdit(item)} />
      <IconButton label={`Xóa ${item.name}`} icon={<Trash2 />} quiet className="kho-actions__delete" disabled={deleting} onClick={() => onDelete(item)} />
    </div>
  );
}

function Quantity({ item }: { item: PantryItem }) {
  const warning = stockWarning(item);
  return (
    <>
      <span className="kho-quantity">{formatPantryQuantity(item.quantity, item.unit)}</span>
      {warning && <span className="kho-sub kho-sub--warn">{warning}</span>}
    </>
  );
}

function Expiry({ item, status }: { item: PantryItem; status: PantryItemStatus }) {
  const expiry = expiryCopy(item);
  return (
    <>
      <span className="kho-date">{expiry.date}</span>
      {expiry.relative && <span className={cx("kho-sub", status !== "good" && "kho-sub--warn")}>{expiry.relative}</span>}
    </>
  );
}

const itemClass = (base: string, item: PantryItem, status: PantryItemStatus, focusedItemId: string | null) =>
  cx(base, status === "expiring" && `${base}--soon`, item.id === focusedItemId && "kho-item--focus");

/** Bảng thực phẩm; ≤ 760px mỗi dòng thành một thẻ (CSS). Dòng sắp hết hạn nền --warn-bg. */
export function PantryTable({ items, focusedItemId, deletingId, onEdit, onDelete }: PantryItemsProps) {
  return (
    <table className="kho-table">
      <thead>
        <tr>
          <th scope="col">Thực phẩm</th>
          <th scope="col">Số lượng</th>
          <th scope="col">Hạn sử dụng</th>
          <th scope="col">Nơi bảo quản</th>
          <th scope="col">Tình trạng</th>
          <th scope="col"><span className="ui-visually-hidden">Thao tác</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const status = getPantryStatus(item);
          return (
            <tr key={item.id} id={pantryItemElementId(item.id)} tabIndex={-1} className={itemClass("kho-row", item, status, focusedItemId)}>
              <td className="kho-row__name">
                <span className="kho-name">{item.name}</span>
                <span className="kho-sub">{item.category}</span>
              </td>
              <td data-label="Số lượng"><Quantity item={item} /></td>
              <td data-label="Hạn sử dụng"><Expiry item={item} status={status} /></td>
              <td data-label="Nơi bảo quản">{storageLabel[item.storageLocation]}</td>
              <td data-label="Tình trạng"><PantryStatusTag status={status} /></td>
              <td className="kho-row__actions">
                <ItemActions item={item} deleting={deletingId === item.id} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Dạng lưới: mỗi thực phẩm một thẻ nhỏ, cùng thông tin và thao tác như bảng. */
export function PantryGrid({ items, focusedItemId, deletingId, onEdit, onDelete }: PantryItemsProps) {
  return (
    <ul className="kho-grid">
      {items.map((item) => {
        const status = getPantryStatus(item);
        return (
          <li key={item.id} id={pantryItemElementId(item.id)} tabIndex={-1} className={itemClass("kho-tile", item, status, focusedItemId)}>
            <div className="kho-tile__head">
              <div className="kho-tile__title">
                <h3 className="kho-name">{item.name}</h3>
                <span className="kho-sub">{item.category}</span>
              </div>
              <PantryStatusTag status={status} />
            </div>
            <dl className="kho-tile__facts">
              <div><dt>Số lượng</dt><dd><Quantity item={item} /></dd></div>
              <div><dt>Hạn sử dụng</dt><dd><Expiry item={item} status={status} /></dd></div>
              <div><dt>Nơi bảo quản</dt><dd>{storageLabel[item.storageLocation]}</dd></div>
            </dl>
            <ItemActions item={item} deleting={deletingId === item.id} onEdit={onEdit} onDelete={onDelete} />
          </li>
        );
      })}
    </ul>
  );
}
