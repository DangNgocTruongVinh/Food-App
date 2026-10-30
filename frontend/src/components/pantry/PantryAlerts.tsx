import { ArrowRight } from "lucide-react";
import { expiryCopy, type PantryCounts, type PantryItemStatus } from "../../features/pantry/pantry.logic";
import type { PantryItem } from "../../types";
import CategoryIcon from "./CategoryIcon";

type PantryAlertsProps = {
  counts: PantryCounts;
  expiringItems: PantryItem[];
  expiredItems: PantryItem[];
  onShowStatus: (status: PantryItemStatus) => void;
};

function AlertList({ items }: { items: PantryItem[] }) {
  return <ul>{items.map((item) => <li key={item.id}>
    <CategoryIcon category={item.category} /><b>{item.name}</b><small>{expiryCopy(item).relative}</small>
  </li>)}</ul>;
}

export default function PantryAlerts({ counts, expiringItems, expiredItems, onShowStatus }: PantryAlertsProps) {
  return <section className="pantry-v2-alert-band" aria-label="Thực phẩm cần chú ý">
    <article className="pantry-v2-alert-pane expiring">
      <div>
        <h2>Cần dùng sớm <span>{counts.expiring}</span></h2>
        {expiringItems.length ? <AlertList items={expiringItems} /> : <p>Không có thực phẩm nào cần dùng trong ba ngày tới.</p>}
      </div>
      <button onClick={() => onShowStatus("expiring")}>Xem tất cả <ArrowRight /></button>
    </article>
    <article className="pantry-v2-alert-pane expired">
      <div>
        <h2>Đã hết hạn <span>{counts.expired}</span></h2>
        {expiredItems.length ? <AlertList items={expiredItems} /> : <p>Kho của bạn hiện không có thực phẩm hết hạn.</p>}
      </div>
      <button onClick={() => onShowStatus("expired")}>Xem chi tiết <ArrowRight /></button>
    </article>
  </section>;
}
