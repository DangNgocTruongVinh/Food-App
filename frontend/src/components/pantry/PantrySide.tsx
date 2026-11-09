import { useQuery } from "@tanstack/react-query";
import { expiryCopy, formatPantryQuantity } from "../../features/pantry/pantry.logic";
import { recommendationQueries } from "../../features/recommendations/recommendations.api";
import type { PantryItem } from "../../types";
import { RecommendationList } from "../recommendations/RecommendationList";
import { Button, Card, Dialog } from "../ui";

const SOON_LIMIT = 5;

function SoonList({ items, onOpen }: { items: PantryItem[]; onOpen: (item: PantryItem) => void }) {
  return (
    <ul className="kho-soon__list">
      {items.slice(0, SOON_LIMIT).map((item) => {
        const expiry = expiryCopy(item);
        return (
          <li key={item.id}>
            <button type="button" className="kho-soon__item" onClick={() => onOpen(item)}>
              <span className="kho-soon__name">{item.name}<span className="kho-soon__qty">{formatPantryQuantity(item.quantity, item.unit)}</span></span>
              <span className="kho-soon__when">{expiry.relative}, hạn {expiry.date}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type PantrySoonCardProps = {
  expiring: PantryItem[];
  expired: PantryItem[];
  onOpen: (item: PantryItem) => void;
  onShowAll: (status: "expiring" | "expired") => void;
};

/** "Cần dùng sớm": lấy từ dữ liệu kho; bấm một món để mở đúng dòng trong bảng. */
export function PantrySoonCard({ expiring, expired, onOpen, onShowAll }: PantrySoonCardProps) {
  return (
    <Card as="section" className="kho-soon" aria-labelledby="kho-soon-title">
      <h2 id="kho-soon-title" className="kho-side__title">Cần dùng sớm</h2>
      <p className="ui-small">Hết hạn trong 3 ngày tới</p>
      {expiring.length
        ? <SoonList items={expiring} onOpen={onOpen} />
        : <p className="ui-text kho-soon__empty">Không có thực phẩm nào sắp hết hạn.</p>}
      {expiring.length > SOON_LIMIT && <Button onClick={() => onShowAll("expiring")}>Xem cả {expiring.length} thực phẩm</Button>}

      <h3 className="kho-soon__subtitle">Đã hết hạn</h3>
      {expired.length
        ? <SoonList items={expired} onOpen={onOpen} />
        : <p className="ui-text kho-soon__empty">Kho của bạn không có thực phẩm đã hết hạn.</p>}
      {expired.length > SOON_LIMIT && <Button onClick={() => onShowAll("expired")}>Xem cả {expired.length} thực phẩm</Button>}
    </Card>
  );
}

/**
 * "Nấu gì từ kho?": bộ gợi ý, ngữ cảnh pantry (thuật toán 3 là chính: dùng đồ sắp hết hạn, nguyên liệu đang có), chỉ món có ít nhất
 * một nguyên liệu trong kho, đã lọc theo hồ sơ; mỗi món có lý do.
 */
export function PantryCookIdeas() {
  const ideas = useQuery(recommendationQueries.list({ context: "pantry", limit: 3 }));
  return (
    <Card as="section" className="kho-cook" aria-labelledby="kho-cook-title">
      <h2 id="kho-cook-title" className="kho-side__title">Nấu gì từ kho?</h2>
      <p className="ui-small">Món hợp hồ sơ của bạn, ưu tiên dùng thực phẩm sắp hết hạn.</p>
      <RecommendationList
        entries={ideas.data?.items ?? []}
        variant="row"
        isLoading={ideas.isLoading}
        isError={ideas.isError}
        isFetching={ideas.isFetching}
        onRetry={() => void ideas.refetch()}
        loadingLabel="Đang tìm món nấu từ kho"
        errorMessage="Chưa tải được gợi ý món."
        emptyMessage="Chưa có món nào dùng được thực phẩm trong kho."
      />
    </Card>
  );
}

/** Hộp thoại "Gợi ý món" cho một thực phẩm sắp hết hạn: món dùng đúng thực phẩm đó (ngữ cảnh pantry + pantryItemId). */
export function PantrySuggestDialog({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const ideas = useQuery(recommendationQueries.list({ context: "pantry", pantryItemId: item.id, limit: 6 }));
  return (
    <Dialog
      title={`Món dùng ${item.name}`}
      description={`${item.name} ${expiryCopy(item).relative.toLocaleLowerCase("vi")}. Các món dưới đây dùng thực phẩm này và hợp hồ sơ của bạn.`}
      onClose={onClose}
      className="kho-suggest"
    >
      <RecommendationList
        entries={ideas.data?.items ?? []}
        variant="row"
        isLoading={ideas.isLoading}
        isError={ideas.isError}
        isFetching={ideas.isFetching}
        onRetry={() => void ideas.refetch()}
        loadingLabel={`Đang tìm món dùng ${item.name}`}
        errorMessage="Chưa tải được gợi ý món."
        emptyMessage={`Chưa có món nào dùng ${item.name} hợp với hồ sơ của bạn.`}
      />
      <div className="ui-dialog__actions"><Button onClick={onClose}>Đóng</Button></div>
    </Dialog>
  );
}
