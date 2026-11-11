import { CalendarPlus, Clock3, Flame, RotateCcw, Shuffle, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { formatNumber, recommendationReason, todayLabel } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { DashboardRecommendedRecipe } from "../../types";
import { Button, ButtonLink } from "../ui";
import { DashboardHeroImage } from "./DashboardHeroImage";

type DashboardHeroProps = {
  greeting: string;
  userName?: string;
  /** Mọi món phù hợp (heroRecipeCandidates): 3 món của dashboard trước, rồi phần còn lại của bộ gợi ý, không trùng. */
  recipes: DashboardRecommendedRecipe[];
  /** Danh sách đầy đủ còn đang tải: tới món cuối đã có thì nút "Đổi món khác" chờ thay vì báo hết. */
  loadingMore: boolean;
  hasProfile: boolean;
};

/**
 * Đầu trang Tổng quan kiểu trang bìa tạp chí ẩm thực: dòng ngày + lời chào, "Hôm nay nấu gì?", "Món của hôm nay" (món gợi ý,
 * lý do từ dữ liệu thật, thời gian, calo, hai nút) và ảnh lớn của đúng món đó (DashboardHeroImage). "Đổi món khác" đi lần lượt
 * hết danh sách; xem hết thì báo và cho "Xem lại từ đầu".
 */
export function DashboardHero({ greeting, userName, recipes, loadingMore, hasProfile }: DashboardHeroProps) {
  const [index, setIndex] = useState(0);
  const total = recipes.length;
  // Danh sách có thể ngắn lại khi dữ liệu tải lại: giữ chỉ số trong phạm vi.
  const current = total ? Math.min(index, total - 1) : 0;
  const recipe = total ? recipes[current] : null;
  const isLast = current === total - 1;
  const exhausted = isLast && !loadingMore && total > 1;
  // Lý do của bộ gợi ý (backend); bản cũ không có thì tự viết theo số nguyên liệu trong kho.
  const reason = recipe ? (recipe.reason ? `${recipe.reason}.` : recommendationReason(recipe, hasProfile)) : null;

  const nextRecipe = () => setIndex(exhausted ? 0 : current + 1);

  return (
    <section className="dash-hero" aria-labelledby="dash-hero-title">
      <div className="dash-hero__inner">
        <div className="dash-hero__copy">
          <p className="dash-hero__dateline">
            <span>{todayLabel()}</span>
            <span>{userName ? `${greeting}, ${userName}` : greeting}</span>
          </p>
          <h1 id="dash-hero-title" className="dash-hero__title">Hôm nay<br />nấu gì?</h1>

          {recipe ? (
            <>
              <div className="dash-feature" aria-live="polite">
                <p className="dash-feature__eyebrow">Món của hôm nay{total > 1 ? ` · ${current + 1}/${total}` : ""}</p>
                <p className="dash-feature__name"><span className="ui-visually-hidden">Gợi ý cho bạn: </span>{recipe.name}</p>
                {reason && <p className="dash-feature__reason">{reason}</p>}
                <ul className="dash-specs" aria-label="Thông tin món">
                  <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
                  <li><Flame aria-hidden="true" />{formatNumber(recipe.calories)} kcal</li>
                </ul>
                {exhausted && <p className="dash-feature__end">Bạn đã xem hết {total} món phù hợp với hồ sơ hôm nay.</p>}
              </div>
              <div className="dash-hero__actions">
                <ButtonLink variant="primary" to={recipeDetailPath(recipe.id)} icon={<UtensilsCrossed />}>Xem công thức</ButtonLink>
                {(total > 1 || loadingMore) && (
                  <Button
                    icon={exhausted ? <RotateCcw /> : <Shuffle />}
                    busy={isLast && loadingMore}
                    onClick={nextRecipe}
                  >
                    {exhausted ? "Xem lại từ đầu" : "Đổi món khác"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="dash-feature__reason">Chưa có món gợi ý cho bạn. Tạo thực đơn tuần để Nouri xếp bữa theo hồ sơ và tủ bếp của bạn.</p>
              <div className="dash-hero__actions">
                <ButtonLink variant="primary" to="/meal-plans" icon={<CalendarPlus />}>Tạo thực đơn</ButtonLink>
                <ButtonLink to="/recipes">Xem công thức</ButtonLink>
              </div>
            </>
          )}
        </div>

        <DashboardHeroImage recipe={recipe} upcoming={recipes.slice(current + 1, current + 3)} />
      </div>
    </section>
  );
}
