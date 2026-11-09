import type { MealPlan, MealType, Recipe } from "../../types";
import { MEAL_ORDER, mealLabels, planDayLabels } from "./meal-plans.logic";

export const portionOptions = [0.5, 1, 1.5, 2, 3, 4] as const;

/** Cả 4 bữa (kể cả bữa phụ khi hồ sơ chỉ 3 bữa) theo thứ tự trong ngày. */
export const mealTypeOptions = MEAL_ORDER.map((value) => ({ value, label: mealLabels[value] }));

/** Công thức đang hiện, hợp bữa và không vi phạm hồ sơ hiện tại (API đã tính fit bằng backend). */
export function addableRecipes(recipes: Recipe[], mealType: MealType, search: string) {
  const query = search.trim().toLocaleLowerCase("vi");
  return recipes
    .filter((recipe) => recipe.fit?.safe !== false)
    .filter((recipe) => !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType))
    .filter((recipe) => {
      if (!query) return true;
      const text = `${recipe.name} ${recipe.cuisine} ${recipe.ingredients.map((item) => item.name).join(" ")}`.toLocaleLowerCase("vi");
      return text.includes(query);
    });
}

/** Bữa gợi ý sẵn khi mở hộp thêm món: bữa đầu tiên trong ngày chưa có món, ngày đủ bữa thì bữa phụ. */
export function defaultMealType(items: Array<{ mealType: MealType }>): MealType {
  return MEAL_ORDER.find((mealType) => !items.some((item) => item.mealType === mealType)) ?? "SNACK";
}

/** Thực đơn còn thêm món được (chưa hoàn tất): đang áp dụng trước, rồi mới nhất theo ngày bắt đầu. */
export function addablePlans(plans: MealPlan[]) {
  return plans
    .filter((plan) => plan.status !== "COMPLETED")
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || b.startDate.localeCompare(a.startDate));
}

/** Lựa chọn ngày của một thực đơn: "Thứ Hai, 09/11". */
export function planDayOptions(plan: Pick<MealPlan, "days"> | undefined) {
  return (plan?.days ?? []).map((day) => {
    const labels = planDayLabels(day);
    return { value: day.id, label: `${labels.weekday}, ${labels.date}` };
  });
}
