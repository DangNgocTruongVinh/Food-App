import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminRecipeSummary } from "../../features/admin/admin.api";
import { deleteBlockedReason, isRecipeUsed, MEAL_TYPE_OPTIONS, usageText } from "../../features/admin/admin-recipes.logic";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { recipeDietLabel } from "../../features/recipes/recipes.logic";
import { IMAGE_WIDTHS } from "../../utils/images";
import { IconButton, RecipeImage, Tag } from "../ui";

type AdminRecipeTableProps = {
  recipes: AdminRecipeSummary[];
  pendingId: string | null;
  onToggleHidden: (recipe: AdminRecipeSummary) => void;
  onDelete: (recipe: AdminRecipeSummary) => void;
};

const mealLabel = (type: string) => MEAL_TYPE_OPTIONS.find(([value]) => value === type)?.[1].replace("Bữa ", "") ?? type;

/** Bảng công thức (≤ 760px mỗi dòng thành thẻ). Xóa chỉ bật khi món chưa được dùng; đã dùng thì giải thích và gợi ý ẩn. */
export function AdminRecipeTable({ recipes, pendingId, onToggleHidden, onDelete }: AdminRecipeTableProps) {
  return (
    <table className="ad-table">
      <thead>
        <tr>
          <th scope="col">Món</th>
          <th scope="col">Ẩm thực</th>
          <th scope="col">Bữa</th>
          <th scope="col">Nhãn</th>
          <th scope="col">Calo</th>
          <th scope="col">Được dùng</th>
          <th scope="col">Trạng thái</th>
          <th scope="col"><span className="ui-visually-hidden">Thao tác</span></th>
        </tr>
      </thead>
      <tbody>
        {recipes.map((recipe) => {
          const reason = deleteBlockedReason(recipe.usage);
          const reasonId = `ad-delete-reason-${recipe.id}`;
          const busy = pendingId === recipe.id;
          return (
            <tr key={recipe.id} className={recipe.hidden ? "ad-row is-hidden" : "ad-row"}>
              <td className="ad-row__name">
                <RecipeImage className="ad-row__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
                <span className="ad-row__title">
                  <Link className="ad-row__link" to={`/admin/recipes/${recipe.id}/edit`}>{recipe.name}</Link>
                  <span className="ad-sub">{recipe.slug}</span>
                </span>
              </td>
              <td data-label="Ẩm thực">{recipe.cuisine}</td>
              <td data-label="Bữa">{recipe.mealTypes.map(mealLabel).join(", ")}</td>
              <td data-label="Nhãn"><span className="ad-tags">{recipe.dietTags.map((tag) => <Tag key={tag}>{recipeDietLabel(tag)}</Tag>)}</span></td>
              <td data-label="Calo" className="ad-num">{formatNumber(recipe.calories)}</td>
              <td data-label="Được dùng" className={isRecipeUsed(recipe.usage) ? undefined : "ad-muted"}>{usageText(recipe.usage)}</td>
              <td data-label="Trạng thái">
                <span className={recipe.hidden ? "ad-status ad-status--hidden" : "ad-status"}>{recipe.hidden ? "Đã ẩn" : "Đang hiện"}</span>
              </td>
              <td className="ad-row__actions">
                <div className="ad-actions">
                  <Link className="ui-icon-button ui-icon-button--quiet" to={`/admin/recipes/${recipe.id}/edit`} aria-label={`Sửa ${recipe.name}`}>
                    <Pencil aria-hidden="true" />
                  </Link>
                  <IconButton
                    quiet
                    label={recipe.hidden ? `Hiện lại ${recipe.name}` : `Ẩn ${recipe.name}`}
                    icon={recipe.hidden ? <Eye /> : <EyeOff />}
                    disabled={busy}
                    onClick={() => onToggleHidden(recipe)}
                  />
                  <IconButton
                    quiet
                    className="ad-actions__delete"
                    label={`Xóa ${recipe.name}`}
                    icon={<Trash2 />}
                    disabled={Boolean(reason) || busy}
                    aria-describedby={reason ? reasonId : undefined}
                    title={reason ?? undefined}
                    onClick={() => onDelete(recipe)}
                  />
                  {reason && <span id={reasonId} className="ui-visually-hidden">{reason}</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
