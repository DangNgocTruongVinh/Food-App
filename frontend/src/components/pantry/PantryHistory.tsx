import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  HISTORY_PAGE_SIZE, HISTORY_SOURCE_LABELS, HISTORY_SOURCES, historyAfter, historyDelta, historyLink, historyNote, historyPageCount,
  historyRange, historyReversalTag, historyTime, ITEM_HISTORY_PAGE_SIZE,
} from "../../features/pantry/pantry-history.logic";
import { pantryQueries } from "../../features/pantry/pantry.queries";
import { cx } from "../../features/ui/ui.logic";
import type { PantryTransaction, PantryTransactionSource } from "../../types";
import { Button, Card, Chip, EmptyState, ErrorState, IconButton, LoadingState, Skeleton, Tag } from "../ui";

/** Các dòng lịch sử: thời gian (giờ Việt Nam), thực phẩm, thay đổi, nguồn, liên kết bữa ăn/thực đơn, "Hoàn lại", số còn lại. */
export function PantryHistoryList({ entries, showName = true }: { entries: PantryTransaction[]; showName?: boolean }) {
  return (
    <ol className="kho-history">
      {entries.map((entry) => {
        const link = historyLink(entry);
        const reversal = historyReversalTag(entry);
        const note = historyNote(entry);
        return (
          <li key={entry.id} className="kho-history__row">
            <div className="kho-history__main">
              {showName && <span className="kho-name">{entry.itemName}</span>}
              <span className="kho-history__tags">
                <Tag>{HISTORY_SOURCE_LABELS[entry.source]}</Tag>
                {reversal && <Tag className="kho-history__reversal">{reversal}</Tag>}
              </span>
              <span className="kho-sub"><time dateTime={entry.createdAt}>{historyTime(entry)}</time></span>
              {link && <Link className="kho-history__link" to={link.to}>{link.label}</Link>}
              {note && <span className="kho-sub">{note}</span>}
            </div>
            <div className="kho-history__change">
              <span className={cx("kho-history__delta", entry.delta < 0 && "is-minus")}>{historyDelta(entry)}</span>
              <span className="kho-sub">{historyAfter(entry)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryPager({ page, pageSize, total, label, onPageChange }: {
  page: number; pageSize: number; total: number; label: string; onPageChange: (page: number) => void;
}) {
  const pageCount = historyPageCount(pageSize, total);
  return (
    <footer className="kho-pager">
      <p className="kho-pager__count" aria-live="polite">{historyRange(page, pageSize, total)}</p>
      {pageCount > 1 && (
        <nav className="kho-pager__pages" aria-label={label}>
          <IconButton label="Trang trước" icon={<ChevronLeft />} quiet disabled={page === 1} onClick={() => onPageChange(page - 1)} />
          <span className="kho-history__page">Trang {page}/{pageCount}</span>
          <IconButton label="Trang sau" icon={<ChevronRight />} quiet disabled={page === pageCount} onClick={() => onPageChange(page + 1)} />
        </nav>
      )}
    </footer>
  );
}

const HistorySkeleton = ({ rows }: { rows: number }) => (
  <LoadingState label="Đang tải lịch sử kho">
    {Array.from({ length: rows }, (_, index) => <Skeleton key={index} kind="block" height={56} />)}
  </LoadingState>
);

const ALL_CHIP_ID = "kho-history-source-all";

/** Phần "Lịch sử" ở trang Kho: mọi thay đổi số lượng của kho, lọc theo nguồn, phân trang (mới nhất trước). */
export function PantryHistorySection() {
  const [source, setSource] = useState<PantryTransactionSource | undefined>();
  const [page, setPage] = useState(1);
  const history = useQuery(pantryQueries.transactions({ source, page, pageSize: HISTORY_PAGE_SIZE }));
  const choose = (next?: PantryTransactionSource) => { setSource(next); setPage(1); };
  // "Xem tất cả" biến mất khi bấm: đưa focus về chip "Tất cả" để người dùng bàn phím không rơi về đầu trang.
  const showAll = () => {
    choose();
    requestAnimationFrame(() => document.getElementById(ALL_CHIP_ID)?.focus());
  };
  const data = history.data;

  return (
    <section className="kho-history-section" aria-labelledby="kho-history-title">
      <header className="kho-history-section__head">
        <h2 id="kho-history-title" className="kho-history-section__title">Lịch sử kho</h2>
        <p className="kho-sub">Mỗi lần thêm, sửa, xóa, ăn (trừ kho) hay mua (cộng kho) đều được ghi lại.</p>
      </header>
      <div className="kho-chips" role="group" aria-label="Lọc lịch sử theo nguồn">
        <Chip id={ALL_CHIP_ID} selected={!source} onClick={() => choose()}>Tất cả</Chip>
        {HISTORY_SOURCES.map((value) => (
          <Chip key={value} selected={source === value} onClick={() => choose(value)}>{HISTORY_SOURCE_LABELS[value]}</Chip>
        ))}
      </div>
      <Card variant="flush" className="kho-panel kho-history-panel">
        {history.isLoading ? (
          <HistorySkeleton rows={4} />
        ) : history.isError ? (
          <ErrorState message="Chưa tải được lịch sử kho." onRetry={() => void history.refetch()} retrying={history.isFetching} />
        ) : !data?.items.length ? (
          source ? (
            <EmptyState
              message={`Chưa có thay đổi nào từ nguồn “${HISTORY_SOURCE_LABELS[source]}”.`}
              action={<Button onClick={showAll}>Xem tất cả</Button>}
            />
          ) : (
            <EmptyState message="Chưa có thay đổi nào trong kho. Thêm thực phẩm, đánh dấu đã ăn hoặc đã mua thì lịch sử hiện ở đây." />
          )
        ) : (
          <>
            <PantryHistoryList entries={data.items} />
            <HistoryPager page={data.page} pageSize={data.pageSize} total={data.total} label="Phân trang lịch sử kho" onPageChange={setPage} />
          </>
        )}
      </Card>
    </section>
  );
}

/** "Xem lịch sử" trong hộp thoại Sửa: các thay đổi của đúng thực phẩm này (trả lời "vì sao còn 200 g"). Chỉ tải khi mở. */
export function PantryItemHistory({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const history = useQuery({ ...pantryQueries.transactions({ pantryItemId: itemId, page, pageSize: ITEM_HISTORY_PAGE_SIZE }), enabled: open });
  const data = history.data;
  return (
    <details className="kho-item-history" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Xem lịch sử</summary>
      {!open ? null : history.isLoading ? (
        <HistorySkeleton rows={2} />
      ) : history.isError ? (
        <ErrorState message="Chưa tải được lịch sử của thực phẩm này." onRetry={() => void history.refetch()} retrying={history.isFetching} />
      ) : !data?.items.length ? (
        <p className="kho-sub">Chưa có thay đổi nào được ghi cho “{itemName}” (lịch sử bắt đầu từ khi Nouri ghi lịch sử kho).</p>
      ) : (
        <>
          <PantryHistoryList entries={data.items} showName={false} />
          <HistoryPager page={data.page} pageSize={data.pageSize} total={data.total} label={`Phân trang lịch sử của ${itemName}`} onPageChange={setPage} />
        </>
      )}
    </details>
  );
}
