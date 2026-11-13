import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  emptyIngredient, emptyStep, moveRow, RECIPE_LIMITS, UNIT_OPTIONS, type IngredientRow, type RecipeFormErrors, type StepRow,
} from "../../features/admin/admin-recipes.logic";
import { allergyMatchesOfFoodName } from "../../features/profile/allergy-groups";
import type { FoodUnit } from "../../types";
import { Button, IconButton } from "../ui";

type IngredientsProps = {
  rows: IngredientRow[];
  errors: RecipeFormErrors["ingredients"];
  /** Lỗi nhãn chay/thuần chay của máy chủ theo dòng (422). */
  dietErrors: Record<string, string>;
  listError?: string;
  onChange: (rows: IngredientRow[]) => void;
};

function RowControls({ index, count, label, onMove, onRemove }: {
  index: number; count: number; label: string; onMove: (delta: -1 | 1) => void; onRemove: () => void;
}) {
  return (
    <div className="ad-rows__controls">
      <IconButton quiet label={`Chuyển ${label} lên`} icon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)} />
      <IconButton quiet label={`Chuyển ${label} xuống`} icon={<ArrowDown />} disabled={index === count - 1} onClick={() => onMove(1)} />
      <IconButton quiet label={`Xóa ${label}`} icon={<X />} disabled={count === 1} onClick={onRemove} />
    </div>
  );
}

/** Danh sách nguyên liệu: thêm/xóa/sắp xếp dòng; lỗi (kể cả lỗi nhãn chay của máy chủ) hiện ngay tại dòng. */
export function AdminIngredientsEditor({ rows, errors, dietErrors, listError, onChange }: IngredientsProps) {
  const update = (key: string, patch: Partial<IngredientRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <section className="ad-form__section" aria-labelledby="ad-form-ingredients">
      <h3 id="ad-form-ingredients" className="ad-form__title">Nguyên liệu</h3>
      <ol className="ad-rows">
        {rows.map((row, index) => {
          const rowErrors = errors[row.key] ?? {};
          const label = `nguyên liệu ${index + 1}`;
          const ids = { name: `${row.key}-name`, quantity: `${row.key}-qty`, unit: `${row.key}-unit`, error: `${row.key}-error`, diet: `${row.key}-diet` };
          const describedBy = [rowErrors.name || rowErrors.quantity ? ids.error : "", dietErrors[row.key] ? ids.diet : ""]
            .filter(Boolean).join(" ") || undefined;
          return (
            <li key={row.key} className={dietErrors[row.key] ? "ad-ingredient has-diet-error" : "ad-ingredient"}>
              <div className="ad-ingredient__fields">
                <label className="ad-ingredient__field ad-ingredient__field--name">
                  <span className="ui-field__label">Tên {label}</span>
                  <input
                    id={ids.name}
                    className="ui-input"
                    value={row.name}
                    aria-invalid={rowErrors.name || dietErrors[row.key] ? true : undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                  />
                </label>
                <label className="ad-ingredient__field">
                  <span className="ui-field__label">Số lượng</span>
                  <input
                    id={ids.quantity}
                    className="ui-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={row.quantity}
                    aria-invalid={rowErrors.quantity ? true : undefined}
                    aria-describedby={rowErrors.quantity ? ids.error : undefined}
                    onChange={(event) => update(row.key, { quantity: event.target.value })}
                  />
                </label>
                <label className="ad-ingredient__field">
                  <span className="ui-field__label">Đơn vị</span>
                  <select id={ids.unit} className="ui-input" value={row.unit} onChange={(event) => update(row.key, { unit: event.target.value as FoodUnit })}>
                    {UNIT_OPTIONS.map(([value, unitLabel]) => <option key={value} value={value}>{unitLabel}</option>)}
                  </select>
                </label>
                <label className="ad-ingredient__optional">
                  <input type="checkbox" checked={row.optional} onChange={(event) => update(row.key, { optional: event.target.checked })} />
                  <span>Tùy chọn</span>
                </label>
                <RowControls
                  index={index}
                  count={rows.length}
                  label={label}
                  onMove={(delta) => onChange(moveRow(rows, index, delta))}
                  onRemove={() => onChange(rows.filter((item) => item.key !== row.key))}
                />
              </div>
              {(rowErrors.name || rowErrors.quantity) && (
                <p id={ids.error} className="ui-field__error">{[rowErrors.name, rowErrors.quantity].filter(Boolean).join(" ")}</p>
              )}
              {dietErrors[row.key] && <p id={ids.diet} className="ad-ingredient__diet" role="alert">{dietErrors[row.key]}</p>}
              <AllergyGroupNote name={row.name} />
            </li>
          );
        })}
      </ol>
      {listError && <p className="ui-field__error">{listError}</p>}
      <Button icon={<Plus />} disabled={rows.length >= RECIPE_LIMITS.ingredients[1]} onClick={() => onChange([...rows, emptyIngredient()])}>
        Thêm nguyên liệu
      </Button>
    </section>
  );
}

/** Nhóm dị ứng Nouri tự nhận ra từ tên nguyên liệu (cùng danh mục với bộ lọc) để Admin kiểm lại trước khi lưu. */
function AllergyGroupNote({ name }: { name: string }) {
  const matches = name.trim() ? allergyMatchesOfFoodName(name) : [];
  if (!matches.length) return null;
  const labels = matches.map(({ group, certain }) => (certain ? group.label : `${group.label} (có thể chứa)`));
  return <p className="ad-ingredient__allergy">Nhóm dị ứng tự nhận ra: {labels.join(", ")}</p>;
}

type StepsProps = { rows: StepRow[]; errors: RecipeFormErrors["steps"]; listError?: string; onChange: (rows: StepRow[]) => void };

/** Các bước làm: thêm/xóa/sắp xếp; đánh số theo thứ tự (đây là trình tự nấu). */
export function AdminStepsEditor({ rows, errors, listError, onChange }: StepsProps) {
  return (
    <section className="ad-form__section" aria-labelledby="ad-form-steps">
      <h3 id="ad-form-steps" className="ad-form__title">Các bước làm</h3>
      <ol className="ad-rows">
        {rows.map((row, index) => {
          const label = `bước ${index + 1}`;
          return (
            <li key={row.key} className="ad-step">
              <label className="ad-step__field">
                <span className="ui-field__label">Bước {index + 1}</span>
                <textarea
                  className="ui-input"
                  rows={2}
                  value={row.text}
                  aria-invalid={errors[row.key] ? true : undefined}
                  aria-describedby={errors[row.key] ? `${row.key}-error` : undefined}
                  onChange={(event) => onChange(rows.map((item) => (item.key === row.key ? { ...item, text: event.target.value } : item)))}
                />
              </label>
              <RowControls
                index={index}
                count={rows.length}
                label={label}
                onMove={(delta) => onChange(moveRow(rows, index, delta))}
                onRemove={() => onChange(rows.filter((item) => item.key !== row.key))}
              />
              {errors[row.key] && <p id={`${row.key}-error`} className="ui-field__error ad-step__error">{errors[row.key]}</p>}
            </li>
          );
        })}
      </ol>
      {listError && <p className="ui-field__error">{listError}</p>}
      <Button icon={<Plus />} disabled={rows.length >= RECIPE_LIMITS.steps[1]} onClick={() => onChange([...rows, emptyStep()])}>Thêm bước</Button>
    </section>
  );
}
