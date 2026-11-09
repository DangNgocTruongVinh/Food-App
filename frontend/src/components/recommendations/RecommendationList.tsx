import { Clock3, Flame, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { recipeDetailPath, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import { cx } from "../../features/ui/ui.logic";
import { IMAGE_WIDTHS } from "../../utils/images";
import { EmptyState, ErrorState, LoadingState, RecipeImage, Skeleton } from "../ui";

// Thẻ món gợi ý dùng chung (GĐ3b-R7) cho Tổng quan, Công thức, Chi tiết món, Kho: ảnh, tên (liên kết chi tiết), calo, thời gian,
// dòng lý do của bộ gợi ý. "tile": thẻ dọc có ảnh lớn; "row": hàng ngang ảnh nhỏ (cột phụ, hộp thoại).

export type RecommendationCardRecipe = {
  id: string; name: string; imageUrl?: string | null; calories: number; prepMinutes: number; cookMinutes: number;
};
export type RecommendationEntry = { recipe: RecommendationCardRecipe; reason?: string };
type Variant = "tile" | "row";

export function RecommendationCard({ entry, variant = "tile", featured = false }: { entry: RecommendationEntry; variant?: Variant; featured?: boolean }) {
  const { recipe, reason } = entry;
  return (
    <article className={cx("rc-card", `rc-card--${variant}`, featured && "rc-card--featured")}>
      <RecipeImage className="rc-card__image" recipe={recipe} width={variant === "row" ? IMAGE_WIDTHS.thumb : IMAGE_WIDTHS.card} alt="" />
      <div className="rc-card__body">
        <h3 className="rc-card__title"><Link to={recipeDetailPath(recipe.id)}>{recipe.name}</Link></h3>
        <ul className="rc-card__specs" aria-label="Thông tin món">
          <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
          <li><Flame aria-hidden="true" />{recipe.calories.toLocaleString("vi-VN")} kcal</li>
        </ul>
        {reason && <p className="rc-card__reason"><Lightbulb aria-hidden="true" /><span>{reason}</span></p>}
      </div>
    </article>
  );
}

type RecommendationListProps = {
  entries: RecommendationEntry[];
  variant?: Variant;
  /** Thẻ đầu lớn hơn (dạng "tile"). */
  featureFirst?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  onRetry?: () => void;
  loadingLabel: string;
  errorMessage: string;
  /** Không có món: câu này (null → không hiện gì). */
  emptyMessage: string | null;
  skeletonCount?: number;
};

/** Danh sách thẻ gợi ý kèm đủ trạng thái: đang tải (khung chờ), lỗi (Thử lại), trống. */
export function RecommendationList({
  entries, variant = "tile", featureFirst = false, isLoading, isError, isFetching, onRetry, loadingLabel, errorMessage, emptyMessage, skeletonCount = 3,
}: RecommendationListProps) {
  if (isLoading) {
    return (
      <LoadingState label={loadingLabel}>
        <div className={cx("rc-list", `rc-list--${variant}`)}>
          {Array.from({ length: skeletonCount }, (_, index) => <Skeleton key={index} kind="block" height={variant === "row" ? 72 : 220} />)}
        </div>
      </LoadingState>
    );
  }
  if (isError) return <ErrorState message={errorMessage} onRetry={onRetry} retrying={isFetching} />;
  if (!entries.length) return emptyMessage ? <EmptyState message={emptyMessage} /> : null;
  return (
    <ul className={cx("rc-list", `rc-list--${variant}`, featureFirst && "rc-list--feature-first")}>
      {entries.map((entry, index) => (
        <li key={entry.recipe.id}><RecommendationCard entry={entry} variant={variant} featured={featureFirst && index === 0} /></li>
      ))}
    </ul>
  );
}
