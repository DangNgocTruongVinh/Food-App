import { useId } from "react";
import {
  DIET_TAG_OPTIONS, MEAL_TYPE_OPTIONS, type NumberField, type RecipeFormErrors, type RecipeFormValues,
} from "../../features/admin/admin-recipes.logic";
import { useCuisineOptions } from "../../features/catalog/catalog.queries";
import { Chip, Field, Combobox } from "../ui";

type ChangeFn = <K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) => void;
type BasicsProps = { form: RecipeFormValues; errors: RecipeFormErrors["fields"]; onChange: ChangeFn };

function ToggleGroup<T extends string>({ legend, options, selected, error, onChange }: {
  legend: string; options: Array<[T, string]>; selected: T[]; error?: string; onChange: (values: T[]) => void;
}) {
  const id = useId();
  return (
    <fieldset className="ad-toggles" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="ui-field__label">{legend}</legend>
      <div className="ad-toggles__options">
        {options.map(([value, label]) => (
          <Chip
            key={value}
            selected={selected.includes(value)}
            onClick={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])}
          >
            {label}
          </Chip>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
    </fieldset>
  );
}

const NUTRITION: Array<[NumberField, string, string]> = [
  ["calories", "Calo", "kcal"], ["proteinG", "Đạm", "g"], ["carbsG", "Tinh bột", "g"], ["fatG", "Béo", "g"], ["fiberG", "Chất xơ", "g"],
];
const TIMES: Array<[NumberField, string, string]> = [["prepMinutes", "Sơ chế", "phút"], ["cookMinutes", "Nấu", "phút"], ["servings", "Khẩu phần", "phần"]];

/** Thông tin chung, thời gian, dinh dưỡng (cho 1 khẩu phần), bữa và nhãn chế độ ăn. */
export function AdminRecipeBasics({ form, errors, onChange }: BasicsProps) {
  const cuisines = useCuisineOptions();
  const numberField = ([key, label, unit]: [NumberField, string, string]) => (
    <Field key={key} label={label} error={errors[key]}>
      {(control) => (
        <span className="ad-unit">
          <input {...control} type="number" inputMode="decimal" min="0" step="any" value={form[key]} onChange={(event) => onChange(key, event.target.value)} />
          <span className="ad-unit__label" aria-hidden="true">{unit}</span>
        </span>
      )}
    </Field>
  );
  return (
    <>
      <section className="ad-form__section" aria-labelledby="ad-form-general">
        <h3 id="ad-form-general" className="ad-form__title">Thông tin chung</h3>
        <div className="ad-form__grid">
          <Field label="Tên món" error={errors.name} className="ad-wide">
            {(control) => <input {...control} value={form.name} onChange={(event) => onChange("name", event.target.value)} />}
          </Field>
          <Field label="Mô tả" error={errors.description} className="ad-wide">
            {(control) => <textarea {...control} rows={3} value={form.description} onChange={(event) => onChange("description", event.target.value)} />}
          </Field>
          <Field label="Ẩm thực" error={errors.cuisine} hint="Dùng đúng tên nhóm có sẵn để lọc theo hồ sơ.">
            {(control) => (
              <>
                <Combobox
                  {...control}
                  value={form.cuisine}
                  onValueChange={(value) => onChange("cuisine", value)}
                  options={cuisines.options}
                  onPick={(option) => onChange("cuisine", option.label)}
                />
              </>
            )}
          </Field>
          <div className="ad-form__row">{TIMES.map(numberField)}</div>
        </div>
      </section>
      <section className="ad-form__section" aria-labelledby="ad-form-nutrition">
        <h3 id="ad-form-nutrition" className="ad-form__title">Dinh dưỡng cho 1 khẩu phần</h3>
        <div className="ad-form__row ad-form__row--5">{NUTRITION.map(numberField)}</div>
      </section>
      <section className="ad-form__section" aria-labelledby="ad-form-tags">
        <h3 id="ad-form-tags" className="ad-form__title">Bữa và nhãn chế độ ăn</h3>
        <ToggleGroup
          legend="Dùng cho bữa"
          options={MEAL_TYPE_OPTIONS}
          selected={form.mealTypes}
          error={errors.mealTypes}
          onChange={(value) => onChange("mealTypes", value)}
        />
        <ToggleGroup
          legend="Nhãn chế độ ăn"
          options={DIET_TAG_OPTIONS}
          selected={form.dietTags}
          error={errors.dietTags}
          onChange={(value) => onChange("dietTags", value)}
        />
        <p className="ui-small">Gắn nhãn Món chay hoặc Thuần chay thì máy chủ kiểm tra từng nguyên liệu; Thuần chay tự thêm Món chay.</p>
      </section>
    </>
  );
}
