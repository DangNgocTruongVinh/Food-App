import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { DashboardRecommendedRecipe } from "../../types";
import { RecommendationList } from "../recommendations/RecommendationList";
import { Button, ButtonLink, EmptyState, Combobox } from "../ui";
import type { ComboOption } from "../../features/ui/combobox.logic";

type RecommendedRecipesProps = {
  recipes: DashboardRecommendedRecipe[];
  search: string;
  /** Gợi ý của ô tìm (tên món, nguyên liệu, ẩm thực); chọn một gợi ý thì mở trang Công thức với từ đó. */
  searchOptions: ComboOption[];
  onSearchPick: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
};

/**
 * "Gợi ý cho bạn" (bộ gợi ý, ngữ cảnh hôm nay; đã lọc theo chế độ ăn, dị ứng, món không thích): các thẻ đều nhau, mỗi món có lý do.
 * Món đầu đã là "Món của hôm nay" ở đầu trang nên không làm thẻ lớn nữa.
 */
export function RecommendedRecipes({ recipes, search, onSearchChange, onSearchSubmit, searchOptions, onSearchPick }: RecommendedRecipesProps) {
  return (
    <section className="dash-recs" aria-labelledby="dash-recs-title">
      <header className="dash-recs__header">
        <div className="dash-recs__intro">
          <h2 id="dash-recs-title" className="dash-section-title">Gợi ý cho bạn</h2>
          <p className="dash-recs__text">Theo hồ sơ ăn uống, khẩu vị và tủ bếp của bạn; mỗi món ghi rõ vì sao được gợi ý.</p>
        </div>
        <form className="dash-search" role="search" onSubmit={onSearchSubmit}>
          <label className="ui-visually-hidden" htmlFor="dash-search">Tìm công thức theo tên món hoặc nguyên liệu</label>
          <Combobox
            id="dash-search"
            className="ui-input"
            type="search"
            value={search}
            onValueChange={onSearchChange}
            options={searchOptions}
            onPick={(option) => onSearchPick(option.label)}
            placeholder="Tìm món hoặc nguyên liệu"
          />
          <Button type="submit" icon={<Search />}>Tìm</Button>
        </form>
      </header>

      {!recipes.length ? (
        <EmptyState message="Chưa có món nào hợp với hồ sơ của bạn." action={<ButtonLink to="/recipes">Xem tất cả công thức</ButtonLink>} />
      ) : (
        <RecommendationList
          entries={recipes.map((recipe) => ({ recipe, reason: recipe.reason }))}
          loadingLabel="Đang tải gợi ý"
          errorMessage="Chưa tải được gợi ý."
          emptyMessage={null}
        />
      )}
      {recipes.length > 0 && <Link className="ui-link dash-recs__all" to="/recipes">Xem tất cả công thức</Link>}
    </section>
  );
}
