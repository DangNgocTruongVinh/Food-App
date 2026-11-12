import { Plus, X } from "lucide-react";
import {
  emptyMemberIngredient, emptyMemberStep, MEMBER_RECIPE_LIMITS as L, type MemberRecipeDraft,
} from "../../features/community/member-recipe.logic";
import { Button, IconButton } from "../ui";

type MemberRecipeFieldsProps = {
  /** Tiền tố id để form đăng bài và hộp sửa bài không trùng id. */
  idPrefix: string;
  draft: MemberRecipeDraft;
  onChange: (draft: MemberRecipeDraft) => void;
  /** Bỏ công thức tự viết (chỉ có ở form đăng bài). */
  onRemove?: () => void;
  error?: string | null;
};

/**
 * Ô nhập công thức tự viết: tên món, khẩu phần, thời gian, nguyên liệu (tên, số lượng, đơn vị — nhập tự do), các bước.
 * Không phải công thức trong thư viện: không vào thực đơn, gợi ý, kho.
 */
export default function MemberRecipeFields({ idPrefix, draft, onChange, onRemove, error }: MemberRecipeFieldsProps) {
  const set = <K extends keyof MemberRecipeDraft>(key: K, value: MemberRecipeDraft[K]) => onChange({ ...draft, [key]: value });
  const setIngredient = (key: string, field: "name" | "quantity" | "unit", value: string) =>
    set("ingredients", draft.ingredients.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const setStep = (key: string, text: string) => set("steps", draft.steps.map((row) => (row.key === key ? { ...row, text } : row)));

  return (
    <fieldset className="cm-member-form">
      <legend className="cm-member-form__title">Tự viết công thức</legend>
      <p className="cm-member-form__note">Công thức của bạn hiện trong bài, không vào thư viện món, thực đơn hay gợi ý.</p>
      {onRemove && <IconButton className="cm-member-form__close" quiet label="Bỏ công thức tự viết" icon={<X />} onClick={onRemove} />}

      <div className="cm-member-form__row">
        <label className="cm-member-field cm-member-field--wide">
          <span>Tên món</span>
          <input id={`${idPrefix}-name`} className="ui-input" value={draft.name} maxLength={L.name} onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="cm-member-field">
          <span>Khẩu phần</span>
          <input className="ui-input" type="number" min={1} max={L.servings} value={draft.servings} onChange={(event) => set("servings", event.target.value)} />
        </label>
        <label className="cm-member-field">
          <span>Thời gian (phút)</span>
          <input className="ui-input" type="number" min={1} max={L.minutes} value={draft.minutes} onChange={(event) => set("minutes", event.target.value)} />
        </label>
      </div>

      <p className="cm-member-form__label">Nguyên liệu</p>
      <ul className="cm-member-rows">
        {draft.ingredients.map((row, index) => (
          <li key={row.key} className="cm-member-ingredient">
            <input
              className="ui-input" aria-label={`Tên nguyên liệu ${index + 1}`} placeholder="Tên, vd. Tôm" maxLength={L.ingredientName}
              value={row.name} onChange={(event) => setIngredient(row.key, "name", event.target.value)}
            />
            <input
              className="ui-input" aria-label={`Số lượng nguyên liệu ${index + 1}`} placeholder="300" maxLength={L.quantity}
              value={row.quantity} onChange={(event) => setIngredient(row.key, "quantity", event.target.value)}
            />
            <input
              className="ui-input" aria-label={`Đơn vị nguyên liệu ${index + 1}`} placeholder="g" maxLength={L.unit}
              value={row.unit} onChange={(event) => setIngredient(row.key, "unit", event.target.value)}
            />
            <IconButton
              quiet label={`Xóa nguyên liệu ${index + 1}`} icon={<X />} disabled={draft.ingredients.length === 1}
              onClick={() => set("ingredients", draft.ingredients.filter((item) => item.key !== row.key))}
            />
          </li>
        ))}
      </ul>
      <Button
        icon={<Plus />} disabled={draft.ingredients.length >= L.ingredients}
        onClick={() => set("ingredients", [...draft.ingredients, emptyMemberIngredient()])}
      >
        Thêm nguyên liệu
      </Button>

      <p className="cm-member-form__label">Các bước</p>
      <ol className="cm-member-rows">
        {draft.steps.map((row, index) => (
          <li key={row.key} className="cm-member-step">
            <textarea
              className="ui-input" rows={2} aria-label={`Bước ${index + 1}`} maxLength={L.step}
              value={row.text} onChange={(event) => setStep(row.key, event.target.value)}
            />
            <IconButton
              quiet label={`Xóa bước ${index + 1}`} icon={<X />} disabled={draft.steps.length === 1}
              onClick={() => set("steps", draft.steps.filter((item) => item.key !== row.key))}
            />
          </li>
        ))}
      </ol>
      <Button icon={<Plus />} disabled={draft.steps.length >= L.steps} onClick={() => set("steps", [...draft.steps, emptyMemberStep()])}>
        Thêm bước
      </Button>
      {error && <p className="cm-composer__error" role="alert">{error}</p>}
    </fieldset>
  );
}
