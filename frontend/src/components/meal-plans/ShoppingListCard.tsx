import { groupShoppingItems } from "../../features/meal-plans/meal-plans.logic";
import type { ShoppingItem } from "../../types";
import { foodUnitLabel } from "../../utils/units";
import { Card, EmptyState } from "../ui";

type ShoppingListCardProps = {
  items: ShoppingItem[];
  pendingId: string | null;
  onToggle: (item: ShoppingItem) => void;
};

const quantityLabel = (item: ShoppingItem) => `${item.quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${foodUnitLabel[item.unit]}`;

/** Danh sách đi chợ theo nhóm; cả dòng là vùng bấm (≥ 52px) để tick "Đã mua" bằng một tay trên điện thoại. */
export function ShoppingListCard({ items, pendingId, onToggle }: ShoppingListCardProps) {
  const purchased = items.filter((item) => item.purchased).length;
  return (
    <Card as="section" className="td-card td-shopping" aria-labelledby="td-shopping-title">
      <header className="td-card__header">
        <h2 id="td-shopping-title" className="td-card__title">Đi chợ</h2>
        {items.length > 0 && <p className="td-shopping__count" aria-live="polite">Đã mua {purchased}/{items.length}</p>}
      </header>
      {!items.length ? (
        <EmptyState message="Kho đã đủ nguyên liệu cho thực đơn này, không cần mua thêm." />
      ) : (
        <div className="td-shop-groups">{groupShoppingItems(items).map((group) => (
          <section key={group.name} className="td-shop-group" aria-label={group.name}>
            <h3 className="td-shop-group__title">{group.name}</h3>
            <ul className="td-shop-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <label className={item.purchased ? "td-shop-item is-bought" : "td-shop-item"}>
                    <input
                      type="checkbox"
                      checked={item.purchased}
                      disabled={pendingId === item.id}
                      onChange={() => onToggle(item)}
                    />
                    <span className="td-shop-item__name"><span className="ui-visually-hidden">Đã mua: </span>{item.name}</span>
                    <span className="td-shop-item__qty">{quantityLabel(item)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}</div>
      )}
    </Card>
  );
}
