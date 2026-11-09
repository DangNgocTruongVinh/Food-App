import { mealTypeOptions, portionOptions } from "../../features/meal-plans/add-meal.logic";
import type { MealType } from "../../types";

type MealSlotFieldsProps = {
  idPrefix: string;
  mealType: MealType;
  servings: string;
  disabled?: boolean;
  onMealTypeChange: (mealType: MealType) => void;
  onServingsChange: (servings: string) => void;
};

/** Chọn bữa (cả bữa phụ) và khẩu phần; dùng chung cho thêm món từ Thực đơn và từ chi tiết công thức. */
export function MealSlotFields({ idPrefix, mealType, servings, disabled, onMealTypeChange, onServingsChange }: MealSlotFieldsProps) {
  return (
    <div className="td-add-meal__portion">
      <label htmlFor={`${idPrefix}-meal`}>Bữa</label>
      <select
        id={`${idPrefix}-meal`}
        className="ui-input"
        value={mealType}
        disabled={disabled}
        onChange={(event) => onMealTypeChange(event.target.value as MealType)}
      >
        {mealTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <label htmlFor={`${idPrefix}-servings`}>Khẩu phần</label>
      <select
        id={`${idPrefix}-servings`}
        className="ui-input"
        value={servings}
        disabled={disabled}
        onChange={(event) => onServingsChange(event.target.value)}
      >
        {portionOptions.map((value) => <option key={value} value={value}>{value.toLocaleString("vi-VN")} khẩu phần</option>)}
      </select>
    </div>
  );
}
