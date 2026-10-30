import { BookOpen, Clock3, Flame, X } from "lucide-react";
import { Link } from "react-router-dom";
import { recipeDetailPath, recipeImageSrc, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { CommunityRecipeSummary } from "../../types";

type RecipeAttachmentCardProps = { recipe: CommunityRecipeSummary; onRemove?: () => void };

/** Thẻ công thức trong bài viết (bấm mở /recipes/:id); có onRemove thì là bản xem trước trong form đăng bài. */
export default function RecipeAttachmentCard({ recipe, onRemove }: RecipeAttachmentCardProps) {
  const body = <>
    <img src={recipeImageSrc(recipe)} alt="" />
    <span className="community-recipe-card-copy">
      <small><BookOpen /> Công thức</small>
      <strong>{recipe.name}</strong>
      {recipe.hidden && <em className="community-recipe-hidden">Đã ngừng sử dụng</em>}
      <span><Flame /> {recipe.calories} kcal <Clock3 /> {recipeTotalMinutes(recipe)} phút</span>
    </span>
  </>;

  if (onRemove) {
    return <div className="community-recipe-card preview">
      {body}
      <button type="button" className="community-recipe-remove" onClick={onRemove} aria-label={`Bỏ chọn ${recipe.name}`}><X /></button>
    </div>;
  }
  return <Link className="community-recipe-card" to={recipeDetailPath(recipe.id)} aria-label={`Xem công thức ${recipe.name}`}>{body}</Link>;
}
