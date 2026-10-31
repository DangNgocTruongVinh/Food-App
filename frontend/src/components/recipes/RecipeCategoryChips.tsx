import { SlidersHorizontal } from "lucide-react";
import { recipeCategories, type RecipeCategory } from "../../features/recipes/recipes.logic";
import { Button, Chip } from "../ui";

type RecipeCategoryChipsProps = {
  category: RecipeCategory;
  counts: Record<RecipeCategory, number>;
  expanded: boolean;
  onToggle: () => void;
  onChange: (category: RecipeCategory) => void;
};

/** Chip danh mục kèm số món thật; nút "Bộ lọc" thu/mở hàng chip như trang cũ. */
export function RecipeCategoryChips({ category, counts, expanded, onToggle, onChange }: RecipeCategoryChipsProps) {
  return (
    <div className="recipes-filters">
      <div id="recipes-categories" className="recipes-filters__chips" role="group" aria-label="Danh mục công thức" hidden={!expanded}>
        {recipeCategories.map((item) => (
          <Chip key={item.id} selected={category === item.id} count={counts[item.id]} onClick={() => onChange(item.id)}>{item.label}</Chip>
        ))}
      </div>
      <Button className="recipes-filters__toggle" icon={<SlidersHorizontal />} aria-expanded={expanded} aria-controls="recipes-categories" onClick={onToggle}>
        Bộ lọc
      </Button>
    </div>
  );
}
