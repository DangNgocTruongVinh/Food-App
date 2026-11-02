import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { CommunityRecipeSummary } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { IconButton, RecipeImage, Tag } from "../ui";

type RecipeAttachmentCardProps = { recipe: CommunityRecipeSummary; onRemove?: () => void };

/** Thẻ công thức trong bài viết (bấm mở /recipes/:id); có onRemove thì là bản xem trước trong form đăng bài. */
export default function RecipeAttachmentCard({ recipe, onRemove }: RecipeAttachmentCardProps) {
  const body = (
    <>
      <RecipeImage className="cm-recipe__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
      <span className="cm-recipe__text">
        <span className="cm-recipe__label">Công thức</span>
        <span className="cm-recipe__name">{recipe.name}</span>
        <span className="cm-recipe__meta">
          <span>{formatNumber(recipe.calories)} kcal</span>
          <span>{recipeTotalMinutes(recipe)} phút</span>
          {recipe.hidden && <Tag className="cm-recipe__hidden">Đã ngừng sử dụng</Tag>}
        </span>
      </span>
    </>
  );

  if (onRemove) {
    return (
      <div className="cm-recipe cm-recipe--preview">
        {body}
        <IconButton label={`Bỏ chọn ${recipe.name}`} icon={<X />} quiet onClick={onRemove} />
      </div>
    );
  }
  return <Link className="cm-recipe" to={recipeDetailPath(recipe.id)} aria-label={`Xem công thức ${recipe.name}`}>{body}</Link>;
}
