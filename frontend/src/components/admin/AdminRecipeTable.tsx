import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminRecipeSummary } from "../../features/admin/admin.api";
import { isRecipeUsed, MEAL_TYPE_OPTIONS, usageText } from "../../features/admin/admin-recipes.logic";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { recipeDietLabel } from "../../features/recipes/recipes.logic";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, IconButton, RecipeImage, Tag } from "../ui";

type AdminRecipeTableProps = {
  recipes: AdminRecipeSummary[];
  pendingId: string | null;
  onToggleHidden: (recipe: AdminRecipeSummary) => void;
  onDelete: (recipe: AdminRecipeSummary) => void;
  onRestore: (recipe: AdminRecipeSummary) => void;
};

const mealLabel = (type: string) => MEAL_TYPE_OPTIONS.find(([value]) => value === type)?.[1].replace("Bữa ", "") ?? type;

const statusText = (recipe: AdminRecipeSummary) => (recipe.deletedAt ? "Đã xóa" : recipe.hidden ? "Đã ẩn" : "Đang hiện");

/** Bảng công thức (≤ 760px mỗi dòng thành thẻ). Món đã xóa mềm (bộ lọc "Đã xóa") chỉ có nút "Khôi phục", không sửa được. */
export function AdminRecipeTable({ recipes, pendingId, onToggleHidden, onDelete, onRestore }: AdminRecipeTableProps) {
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
          const busy = pendingId === recipe.id;
          return (
            <tr key={recipe.id} className={recipe.hidden ? "ad-row is-hidden" : "ad-row"}>
              <td className="ad-row__name">
                <RecipeImage className="ad-row__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
                <span className="ad-row__title">
                  {recipe.deletedAt
                    ? <span className="ad-row__link">{recipe.name}</span>
                    : <Link className="ad-row__link" to={`/admin/recipes/${recipe.id}/edit`}>{recipe.name}</Link>}
                  <span className="ad-sub">{recipe.slug}</span>
                </span>
              </td>
              <td data-label="Ẩm thực">{recipe.cuisine}</td>
              <td data-label="Bữa">{recipe.mealTypes.map(mealLabel).join(", ")}</td>
              <td data-label="Nhãn"><span className="ad-tags">{recipe.dietTags.map((tag) => <Tag key={tag}>{recipeDietLabel(tag)}</Tag>)}</span></td>
              <td data-label="Calo" className="ad-num">{formatNumber(recipe.calories)}</td>
              <td data-label="Được dùng" className={isRecipeUsed(recipe.usage) ? undefined : "ad-muted"}>{usageText(recipe.usage)}</td>
              <td data-label="Trạng thái">
                <span className={recipe.hidden || recipe.deletedAt ? "ad-status ad-status--hidden" : "ad-status"}>{statusText(recipe)}</span>
              </td>
              <td className="ad-row__actions">
                <div className="ad-actions">
                  {recipe.deletedAt ? (
                    <Button icon={<RotateCcw />} disabled={busy} onClick={() => onRestore(recipe)} aria-label={`Khôi phục ${recipe.name}`}>
                      Khôi phục
                    </Button>
                  ) : (
                    <>
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
                      disabled={busy}
                      title={isRecipeUsed(recipe.usage) ? "Đang được dùng: xóa mềm (dữ liệu cũ vẫn giữ tên món)" : "Chưa được dùng: xóa hẳn"}
                      onClick={() => onDelete(recipe)}
                    />
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
