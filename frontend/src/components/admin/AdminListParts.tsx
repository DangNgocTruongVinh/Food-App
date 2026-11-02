import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { IconButton } from "../ui";

/** Ô tìm kiếm của các bảng Admin. */
export function AdminSearch({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="ad-search" role="search">
      <label className="ui-visually-hidden" htmlFor={id}>{label}</label>
      <Search className="ad-search__icon" aria-hidden="true" />
      <input id={id} className="ui-input ad-search__input" type="search" value={value} placeholder={label} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

type AdminPagerProps = { label: string; summary: string; page: number; total: number; pageSize: number; onPageChange: (page: number) => void };

/** Chân bảng: tổng + trang hiện tại; nút trước/sau khi có nhiều trang. */
export function AdminPager({ label, summary, page, total, pageSize, onPageChange }: AdminPagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="ad-pager">
      <p className="ad-pager__count" aria-live="polite">{summary}, trang {page}/{pageCount}.</p>
      {pageCount > 1 && (
        <nav className="ad-pager__nav" aria-label={label}>
          <IconButton quiet label="Trang trước" icon={<ChevronLeft />} disabled={page === 1} onClick={() => onPageChange(page - 1)} />
          <IconButton quiet label="Trang sau" icon={<ChevronRight />} disabled={page === pageCount} onClick={() => onPageChange(page + 1)} />
        </nav>
      )}
    </footer>
  );
}
