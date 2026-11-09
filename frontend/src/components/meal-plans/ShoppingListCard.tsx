import { groupShoppingItems } from "../../features/meal-plans/meal-plans.logic";
import type { ShoppingNotice } from "../../features/meal-plans/shopping-purchase.logic";
import type { ShoppingItem } from "../../types";
import { foodUnitLabel } from "../../utils/units";
import { ButtonLink, Card, EmptyState } from "../ui";

type ShoppingListCardProps = {
  items: ShoppingItem[];
  pendingId: string | null;
  notice: ShoppingNotice | null;
  onToggle: (item: ShoppingItem) => void;
};

const quantityLabel = (item: ShoppingItem) => `${item.quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${foodUnitLabel[item.unit]}`;

/**
 * Dòng nhắc sau khi tick/bỏ tick: đã thêm gì vào kho (kèm "Sửa" mở đúng thực phẩm ở Kho) hoặc đã hoàn lại gì. Đặt cuối thẻ và
 * dính đáy màn hình (CSS, `.td-shop-live`) để vẫn thấy khi tick món ở cuối danh sách dài.
 */
function PurchaseNotice({ notice }: { notice: ShoppingNotice }) {
  const error = notice.kind === "error";
  return (
    <p className={error ? "ui-notice ui-notice--error td-shop-notice" : "ui-notice td-shop-notice"} role={error ? "alert" : undefined}>
      {notice.message}
      {notice.pantryItemId && <ButtonLink to={`/pantry?item=${encodeURIComponent(notice.pantryItemId)}`}>Sửa</ButtonLink>}
    </p>
  );
}

/** Danh sách đi chợ theo nhóm; cả dòng là vùng bấm (≥ 52px) để tick "Đã mua" bằng một tay trên điện thoại. Tick là thêm vào kho. */
export function ShoppingListCard({ items, pendingId, notice, onToggle }: ShoppingListCardProps) {
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
      {/* Vùng aria-live luôn có sẵn (kể cả khi trống) để trình đọc màn hình đọc mỗi dòng nhắc mới. */}
      <div className="td-shop-live" aria-live="polite">{notice && <PurchaseNotice key={notice.message} notice={notice} />}</div>
    </Card>
  );
}
