import { Heart, Search } from "lucide-react";
import { ButtonLink } from "../ui";

type RecipesHeroProps = { total: number; search: string; onSearchChange: (value: string) => void };

/** Đầu trang Công thức (gọn, không ảnh): H1 + mô tả có số món thật + ô tìm kiếm. */
export function RecipesHero({ total, search, onSearchChange }: RecipesHeroProps) {
  return (
    <section className="recipes-hero" aria-labelledby="recipes-title">
      <div className="recipes-hero__inner">
        <h1 id="recipes-title" className="ui-hero-title">Bếp nhà,<br />nấu mỗi ngày.</h1>
        <p className="ui-text">{total} công thức ghi rõ thời gian, calo và cảnh báo khi có thứ bạn dị ứng.</p>
        <div><ButtonLink to="/recipes/favorites" icon={<Heart />}>Món yêu thích</ButtonLink></div>
        <div className="recipes-search" role="search">
          <label className="ui-visually-hidden" htmlFor="recipes-search">Tìm món ăn hoặc nguyên liệu</label>
          <Search className="recipes-search__icon" aria-hidden="true" />
          <input
            id="recipes-search"
            className="ui-input recipes-search__input"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm món ăn hoặc nguyên liệu"
          />
        </div>
      </div>
    </section>
  );
}
