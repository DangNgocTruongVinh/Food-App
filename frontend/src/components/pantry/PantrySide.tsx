import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { recommendedRecipePantryNote } from "../../features/dashboard/dashboard.logic";
import { dashboardQueries } from "../../features/dashboard/dashboard.queries";
import { expiryCopy, formatPantryQuantity } from "../../features/pantry/pantry.logic";
import type { PantryItem } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, Card, RecipeImage } from "../ui";

const SOON_LIMIT = 5;

function SoonList({ items, onOpen }: { items: PantryItem[]; onOpen: (item: PantryItem) => void }) {
  return (
    <ul className="kho-soon__list">
      {items.slice(0, SOON_LIMIT).map((item) => {
        const expiry = expiryCopy(item);
        return (
          <li key={item.id}>
            <button type="button" className="kho-soon__item" onClick={() => onOpen(item)}>
              <span className="kho-soon__name">{item.name}<span className="kho-soon__qty">{formatPantryQuantity(item.quantity, item.unit)}</span></span>
              <span className="kho-soon__when">{expiry.relative}, hạn {expiry.date}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type PantrySoonCardProps = {
  expiring: PantryItem[];
  expired: PantryItem[];
  onOpen: (item: PantryItem) => void;
  onShowAll: (status: "expiring" | "expired") => void;
};

/** "Cần dùng sớm": lấy từ dữ liệu kho; bấm một món để mở đúng dòng trong bảng. */
export function PantrySoonCard({ expiring, expired, onOpen, onShowAll }: PantrySoonCardProps) {
  return (
    <Card as="section" className="kho-soon" aria-labelledby="kho-soon-title">
      <h2 id="kho-soon-title" className="kho-side__title">Cần dùng sớm</h2>
      <p className="ui-small">Hết hạn trong 3 ngày tới</p>
      {expiring.length
        ? <SoonList items={expiring} onOpen={onOpen} />
        : <p className="ui-text kho-soon__empty">Không có thực phẩm nào sắp hết hạn.</p>}
      {expiring.length > SOON_LIMIT && <Button onClick={() => onShowAll("expiring")}>Xem cả {expiring.length} thực phẩm</Button>}

      <h3 className="kho-soon__subtitle">Đã hết hạn</h3>
      {expired.length
        ? <SoonList items={expired} onOpen={onOpen} />
        : <p className="ui-text kho-soon__empty">Kho của bạn không có thực phẩm đã hết hạn.</p>}
      {expired.length > SOON_LIMIT && <Button onClick={() => onShowAll("expired")}>Xem cả {expired.length} thực phẩm</Button>}
    </Card>
  );
}

/**
 * "Nấu gì từ kho?": dùng gợi ý theo hồ sơ có sẵn của Tổng quan (API đã ưu tiên món dùng nguyên liệu sắp hết hạn,
 * rồi món dùng nhiều nguyên liệu trong kho). Chỉ hiện món thật sự dùng nguyên liệu trong kho; không có thì ẩn khối.
 */
export function PantryCookIdeas() {
  const overview = useQuery(dashboardQueries.overview());
  const recipes = (overview.data?.recommendedRecipes ?? []).filter((recipe) => (recipe.pantryIngredientCount ?? 0) > 0);
  if (!recipes.length) return null;
  return (
    <Card as="section" className="kho-cook" aria-labelledby="kho-cook-title">
      <h2 id="kho-cook-title" className="kho-side__title">Nấu gì từ kho?</h2>
      <p className="ui-small">Món hợp hồ sơ của bạn, dùng nguyên liệu đang có.</p>
      <ul className="kho-cook__list">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="kho-cook__item">
            <RecipeImage className="kho-cook__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
            <div className="kho-cook__text">
              <Link className="kho-cook__name" to={`/recipes/${recipe.id}`}>{recipe.name}</Link>
              <span className="kho-cook__note">{recommendedRecipePantryNote(recipe)}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
