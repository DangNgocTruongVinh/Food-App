import { Heart, Search } from "lucide-react";
import type { ComboOption } from "../../features/ui/combobox.logic";
import { ButtonLink, Combobox } from "../ui";

type RecipesHeroProps = { totalText: string; search: string; onSearchChange: (value: string) => void; options: ComboOption[] };

/** Đầu trang Công thức (gọn, không ảnh): H1 + mô tả có số món thật + ô tìm kiếm. */
export function RecipesHero({ totalText, search, onSearchChange, options }: RecipesHeroProps) {
  return (
    <section className="recipes-hero" aria-labelledby="recipes-title">
      <div className="recipes-hero__inner">
        <h1 id="recipes-title" className="ui-hero-title">Bếp nhà,<br />nấu mỗi ngày.</h1>
        <p className="ui-text">{totalText}, ghi rõ thời gian, calo và cảnh báo khi có thứ bạn dị ứng.</p>
        <div><ButtonLink to="/recipes/favorites" icon={<Heart />}>Món yêu thích</ButtonLink></div>
        <div className="recipes-search" role="search">
          <label className="ui-visually-hidden" htmlFor="recipes-search">Tìm món ăn hoặc nguyên liệu</label>
          <Search className="recipes-search__icon" aria-hidden="true" />
          <Combobox
            id="recipes-search"
            className="ui-input recipes-search__input"
            type="search"
            value={search}
            onValueChange={onSearchChange}
            options={options}
            onPick={(option) => onSearchChange(option.label)}
            placeholder="Tìm món, nguyên liệu, ẩm thực (vd. com tron, đậu hũ)"
          />
        </div>
      </div>
    </section>
  );
}
