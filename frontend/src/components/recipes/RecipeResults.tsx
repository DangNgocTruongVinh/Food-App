import { ChevronLeft, ChevronRight, Grid2X2, List } from "lucide-react";
import type { RecipeSort } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { Button, Chip, EmptyState, IconButton } from "../ui";
import { RecipeCard } from "./RecipeCard";

type RecipeResultsProps = {
  total: number;
  recipes: Recipe[];
  view: "grid" | "list";
  sort: RecipeSort;
  currentPage: number;
  totalPages: number;
  onViewChange: (view: "grid" | "list") => void;
  onSortChange: (sort: RecipeSort) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  /** Số món vi phạm dị ứng/chế độ ăn của người dùng (ẩn mặc định); 0 thì không hiện công tắc. */
  hiddenCount: number;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
};

/** "Tất cả công thức": lưới/danh sách, sắp xếp, phân trang (giữ chức năng trang cũ). */
export function RecipeResults(props: RecipeResultsProps) {
  const { total, recipes, view, sort, currentPage, totalPages } = props;
  return (
    <section className="recipes-section" aria-labelledby="recipes-all-title">
      <header className="recipes-results__header">
        <h2 id="recipes-all-title" className="ui-section-title">Tất cả công thức</h2>
        <p className="recipes-results__count" aria-live="polite">{total} món</p>
        <div className="recipes-results__tools">
          <IconButton label="Hiển thị dạng lưới" icon={<Grid2X2 />} pressed={view === "grid"} quiet onClick={() => props.onViewChange("grid")} />
          <IconButton label="Hiển thị dạng danh sách" icon={<List />} pressed={view === "list"} quiet onClick={() => props.onViewChange("list")} />
          <label className="ui-visually-hidden" htmlFor="recipes-sort">Sắp xếp công thức</label>
          <select id="recipes-sort" className="ui-input recipes-results__sort" value={sort} onChange={(event) => props.onSortChange(event.target.value as RecipeSort)}>
            <option value="newest">Mới nhất</option>
            <option value="quickest">Nhanh nhất</option>
            <option value="calories">Ít calo</option>
            <option value="protein">Nhiều đạm</option>
          </select>
        </div>
      </header>

      {props.hiddenCount > 0 && (
        <div className="recipes-results__profile">
          <p className="ui-small">
            {props.showAll
              ? `Đang hiện cả ${props.hiddenCount} món có thành phần bạn dị ứng hoặc không hợp chế độ ăn của bạn.`
              : `Đã ẩn ${props.hiddenCount} món có thành phần bạn dị ứng hoặc không hợp chế độ ăn của bạn.`}
          </p>
          <Chip selected={props.showAll} onClick={() => props.onShowAllChange(!props.showAll)}>Hiện tất cả</Chip>
        </div>
      )}

      {recipes.length ? (
        <ul className={`recipes-results__list recipes-results__list--${view}`}>
          {recipes.map((recipe) => <li key={recipe.id}><RecipeCard recipe={recipe} layout={view} /></li>)}
        </ul>
      ) : (
        <EmptyState message="Không có công thức nào khớp với từ khóa và danh mục đang chọn." action={<Button onClick={props.onClearFilters}>Xóa bộ lọc</Button>} />
      )}

      {totalPages > 1 && (
        <nav className="recipes-pager" aria-label="Phân trang công thức">
          <IconButton label="Trang trước" icon={<ChevronLeft />} quiet disabled={currentPage === 1} onClick={() => props.onPageChange(currentPage - 1)} />
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              className="recipes-pager__page"
              aria-current={currentPage === page ? "page" : undefined}
              aria-label={`Trang ${page}`}
              onClick={() => props.onPageChange(page)}
            >
              {page}
            </button>
          ))}
          <IconButton label="Trang sau" icon={<ChevronRight />} quiet disabled={currentPage === totalPages} onClick={() => props.onPageChange(currentPage + 1)} />
        </nav>
      )}
    </section>
  );
}
