import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../ui";

type PantryPagerProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Chân bảng: đang hiện mấy thực phẩm + phân trang (chỉ hiện nút trang khi có hơn 1 trang). */
export function PantryPager({ page, pageCount, pageSize, total, onPageChange }: PantryPagerProps) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <footer className="kho-pager">
      <p className="kho-pager__count" aria-live="polite">Hiển thị {first}–{last} trong {total} thực phẩm</p>
      {pageCount > 1 && (
        <nav className="kho-pager__pages" aria-label="Phân trang thực phẩm">
          <IconButton label="Trang trước" icon={<ChevronLeft />} quiet disabled={page === 1} onClick={() => onPageChange(page - 1)} />
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              className="kho-pager__page"
              aria-current={page === number ? "page" : undefined}
              aria-label={`Trang ${number}`}
              onClick={() => onPageChange(number)}
            >
              {number}
            </button>
          ))}
          <IconButton label="Trang sau" icon={<ChevronRight />} quiet disabled={page === pageCount} onClick={() => onPageChange(page + 1)} />
        </nav>
      )}
    </footer>
  );
}
