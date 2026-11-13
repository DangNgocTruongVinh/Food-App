import { AlertTriangle, BookCheck, Clock3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { memberIngredientLabel } from "../../features/community/member-recipe.logic";
import type { MemberRecipe } from "../../types";

type MemberRecipeCardProps = {
  recipe: MemberRecipe;
  /** Từ khóa dị ứng của người xem có trong món (backend so theo hồ sơ người xem). */
  allergens?: string[];
  /** Món trong thư viện tạo từ công thức này (Admin "Chuyển thành công thức"). */
  promoted?: { id: string; name: string } | null;
  /** Liên kết món trong thư viện: trang chi tiết (người dùng) hoặc trang sửa (Admin). */
  promotedHref?: (id: string) => string;
};

/**
 * Công thức tự viết trong bài: nhãn "Công thức của thành viên", ghi chú chưa kiểm duyệt dinh dưỡng, cảnh báo dị ứng theo
 * hồ sơ người xem (chỉ theo từ khóa), nguyên liệu và các bước (thu gọn được).
 */
export default function MemberRecipeCard({ recipe, allergens = [], promoted, promotedHref = (id) => `/recipes/${id}` }: MemberRecipeCardProps) {
  return (
    <section className="cm-member-recipe" aria-label={`Công thức của thành viên: ${recipe.name}`}>
      <p className="cm-member-recipe__label">Công thức của thành viên</p>
      <h3 className="cm-member-recipe__name">{recipe.name}</h3>
      <p className="cm-member-recipe__meta">
        <span><Users aria-hidden="true" />{recipe.servings} khẩu phần</span>
        <span><Clock3 aria-hidden="true" />{recipe.minutes} phút</span>
      </p>
      {allergens.length > 0 && (
        <p className="cm-member-recipe__allergy" role="note">
          <AlertTriangle aria-hidden="true" />
          Chứa: {allergens.join(", ")}. Kiểm tra kỹ nguyên liệu trước khi nấu.
        </p>
      )}
      <p className="cm-member-recipe__note">Chưa được kiểm duyệt dinh dưỡng. Cảnh báo dị ứng chỉ dựa trên tên nguyên liệu.</p>
      <details className="cm-member-recipe__details">
        <summary>Xem nguyên liệu và các bước</summary>
        <h4 className="cm-member-recipe__sub">Nguyên liệu</h4>
        <ul className="cm-member-recipe__list">
          {recipe.ingredients.map((item, index) => <li key={`${item.name}-${index}`}>{memberIngredientLabel(item)}</li>)}
        </ul>
        <h4 className="cm-member-recipe__sub">Các bước</h4>
        <ol className="cm-member-recipe__steps">
          {recipe.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      </details>
      {promoted && (
        <p className="cm-member-recipe__promoted">
          <BookCheck aria-hidden="true" />
          Đã được thêm vào thư viện: <Link className="ui-link" to={promotedHref(promoted.id)}>{promoted.name}</Link>
        </p>
      )}
    </section>
  );
}
