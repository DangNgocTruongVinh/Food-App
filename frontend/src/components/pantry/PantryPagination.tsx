import { ChevronLeft, ChevronRight } from "lucide-react";

type PantryPaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export default function PantryPagination({ page, pageCount, pageSize, total, onPageChange }: PantryPaginationProps) {
  return <footer className="pantry-pagination">
    <span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trong {total} thực phẩm</span>
    <nav aria-label="Phân trang">
      <button disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /></button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
        <button key={number} className={page === number ? "active" : ""} onClick={() => onPageChange(number)}>{number}</button>
      ))}
      <button disabled={page === pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight /></button>
    </nav>
  </footer>;
}
