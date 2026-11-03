import type { MealPlan, MealPlanDay, MealPlanItem, MealPlanStatus, MealType, NutritionProfile, ShoppingItem } from "../../types";
import { FOOD_CATEGORIES } from "../../utils/food-categories";

export const mealLabels: Record<MealType, string> = {
  BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", DINNER: "Bữa tối", SNACK: "Bữa phụ",
};
/** Thứ tự bữa trong ngày (cùng thứ tự với Tổng quan). */
export const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

export function orderDayMeals(items: MealPlanItem[]) {
  return [...items].sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));
}

export function selectMealPlanDay(plan: MealPlan | undefined, selectedDayIndex: number) {
  return plan?.days[selectedDayIndex] ?? plan?.days[0];
}

/** Ngày lịch của một ngày trong thực đơn (server lưu 00:00 UTC): lấy phần yyyy-MM-dd, không đổi múi giờ. */
export function planDayDate(day: Pick<MealPlanDay, "date">) {
  const [year, month, date] = day.date.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, date);
}

const isSameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Vị trí của hôm nay trong thực đơn; -1 nếu hôm nay không thuộc thực đơn. */
export function todayDayIndex(plan: Pick<MealPlan, "days"> | undefined, now = new Date()) {
  return plan?.days.findIndex((day) => isSameLocalDay(planDayDate(day), now)) ?? -1;
}

/** Ngày mở sẵn khi vào một thực đơn: hôm nay nếu có trong thực đơn, không thì ngày đầu. */
export function initialDayIndex(plan: Pick<MealPlan, "days"> | undefined, now = new Date()) {
  return Math.max(0, todayDayIndex(plan, now));
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WEEKDAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = (value: number) => String(value).padStart(2, "0");

export function planDayLabels(day: Pick<MealPlanDay, "date">) {
  const date = planDayDate(day);
  return { weekday: WEEKDAYS[date.getDay()], short: WEEKDAYS_SHORT[date.getDay()], date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}` };
}

/** Tên thực đơn từ backend có dạng "Thực đơn 2/11/2026": tách phần sau "Thực đơn" để in nghiêng ở H1. */
export function planTitleParts(name: string) {
  const match = name.match(/^(Thực đơn)\s+(.+)$/);
  return match ? { lead: match[1], emphasis: match[2] } : { lead: name, emphasis: "" };
}

export const mealPlanStatusLabels: Record<MealPlanStatus, string> = { ACTIVE: "Đang áp dụng", DRAFT: "Bản nháp", COMPLETED: "Đã hoàn thành" };

/** Thống kê cả tuần (bữa đã ăn, đã mua, trung bình mỗi ngày). */
export function summarizeMealPlan(plan: MealPlan | undefined) {
  const planMeals = plan?.days.flatMap((day) => day.items) ?? [];
  const completedMeals = planMeals.filter((item) => item.completed).length;
  const purchasedItems = plan?.shoppingItems.filter((item) => item.purchased).length ?? 0;
  const dayCount = Math.max(plan?.days.length ?? 0, 1);
  const nutrition = planMeals.reduce((totals, item) => ({
    calories: totals.calories + item.calories,
    protein: totals.protein + item.recipe.proteinG,
    carbs: totals.carbs + item.recipe.carbsG,
    fat: totals.fat + item.recipe.fatG,
    fiber: totals.fiber + item.recipe.fiberG,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const averages = {
    calories: Math.round(nutrition.calories / dayCount),
    protein: Math.round(nutrition.protein / dayCount),
    carbs: Math.round(nutrition.carbs / dayCount),
    fat: Math.round(nutrition.fat / dayCount),
    fiber: Math.round(nutrition.fiber / dayCount),
  };
  return { planMeals, completedMeals, purchasedItems, nutrition, averages };
}

export type PlanTargets = { calories: number; protein: number; carbs: number; fat: number };

/** Chỉ tiêu từ hồ sơ dinh dưỡng; chưa có hồ sơ (hoặc chưa tính chỉ tiêu) → null, không dùng số tự đặt. */
export function planTargets(profile: NutritionProfile | null | undefined): PlanTargets | null {
  if (!profile?.dailyCalorieTarget) return null;
  return { calories: profile.dailyCalorieTarget, protein: profile.proteinTargetG ?? 0, carbs: profile.carbTargetG ?? 0, fat: profile.fatTargetG ?? 0 };
}

const percentOf = (value: number, target: number) => (target > 0 ? Math.round((value / target) * 100) : 0);
const progress = (value: number, target: number) => ({ consumed: Math.round(value), target, percent: percentOf(value, target) });

/** Tổng dinh dưỡng các bữa trong ngày (calo đã tính khẩu phần; đạm/tinh bột/béo = công thức × khẩu phần) so với chỉ tiêu. */
export function dayNutrition(items: MealPlanItem[], targets: PlanTargets) {
  const sum = (pick: (item: MealPlanItem) => number) => items.reduce((total, item) => total + pick(item) * (item.servings || 1), 0);
  const calories = items.reduce((total, item) => total + item.calories, 0);
  const eaten = items.filter((item) => item.completed);
  return {
    calories: progress(calories, targets.calories),
    macros: {
      protein: progress(sum((item) => item.recipe.proteinG), targets.protein),
      carbs: progress(sum((item) => item.recipe.carbsG), targets.carbs),
      fat: progress(sum((item) => item.recipe.fatG), targets.fat),
    },
    eatenCount: eaten.length,
    eatenCalories: eaten.reduce((total, item) => total + item.calories, 0),
    mealCount: items.length,
  };
}

/** Món cùng bữa ở các ngày khác trong tuần (tối đa 2), kèm ngày của món. */
export function alternativeMeals(plan: MealPlan, mealType: MealType, primaryId?: string) {
  return plan.days.flatMap((day) => day.items.map((item) => ({ item, day })))
    .filter(({ item }) => item.mealType === mealType && item.id !== primaryId)
    .slice(0, 2);
}

export function mealPlanPath(id?: string | null) {
  return id ? `/meal-plans/${encodeURIComponent(id)}` : "/meal-plans";
}

type PlanOrderFields = Pick<MealPlan, "id" | "startDate" | "createdAt">;

// Mới nhất theo ngày bắt đầu; trùng ngày thì thực đơn tạo sau (createdAt) đứng trước.
function compareNewestFirst(a: PlanOrderFields, b: PlanOrderFields) {
  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
}

/** Thực đơn mở khi vào /meal-plans không kèm id. */
export function latestMealPlanId(plans: PlanOrderFields[], excludeId?: string) {
  return [...plans].filter((plan) => plan.id !== excludeId).sort(compareNewestFirst)[0]?.id ?? null;
}

export function nextMealPlanIdAfterDelete(plans: PlanOrderFields[], deletedId: string) {
  return latestMealPlanId(plans, deletedId);
}

/** Hộp xác nhận xóa: nêu tên, nói rõ nếu đang áp dụng và hậu quả. */
export function mealPlanDeleteConfirm(plan: Pick<MealPlan, "name" | "status">) {
  const activeWarning = plan.status === "ACTIVE" ? "Thực đơn này đang được áp dụng. " : "";
  return {
    title: `Xóa “${plan.name}”?`,
    description: `${activeWarning}Toàn bộ bữa ăn, đánh dấu đã ăn và danh sách đi chợ của thực đơn sẽ bị xóa. Không hoàn tác được.`,
    confirmLabel: "Xóa thực đơn",
  };
}

// ---------- Danh sách đi chợ ----------

/** Danh sách đi chợ theo nhóm (thứ tự 8 nhóm chung), trong nhóm: chưa mua trước, rồi theo tên. */
export function groupShoppingItems<T extends Pick<ShoppingItem, "name" | "purchased"> & { category?: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    // Nhóm do backend gán (services/food-category.ts); thiếu thì "Khác".
    const group = item.category?.trim() || "Khác";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  });
  const rank = (group: string) => {
    const index = (FOOD_CATEGORIES as readonly string[]).indexOf(group);
    return index < 0 ? FOOD_CATEGORIES.length - 1 : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "vi"))
    .map(([name, groupItems]) => ({
      name,
      items: [...groupItems].sort((a, b) => Number(a.purchased) - Number(b.purchased) || a.name.localeCompare(b.name, "vi")),
    }));
}

// ---------- Gợi ý dinh dưỡng ----------

/** Lượng chất xơ khuyến nghị mỗi ngày dùng cho gợi ý (hồ sơ chưa có chỉ tiêu chất xơ). */
export const FIBER_TARGET_G = 30;

export type MealPlanSuggestion = { key: string; text: string };
type SuggestionCandidate = MealPlanSuggestion & { excludedDiets?: string[]; conflicts?: string[] };

const asWords = (value: string) => ` ${value.trim().toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

// Gợi ý không được mâu thuẫn với chế độ ăn, dị ứng hoặc món không thích (vd. "cá hồi" ↔ "cá", "Hải sản").
function conflictsWithProfile(candidate: SuggestionCandidate, profile: NutritionProfile | null | undefined) {
  if (!profile) return false;
  if (candidate.excludedDiets?.includes(profile.dietType)) return true;
  const restrictions = [...(profile.allergies ?? []), ...(profile.dislikedFoods ?? [])].map(asWords).filter((item) => item.trim());
  return (candidate.conflicts ?? []).map(asWords).some((term) => restrictions.some((item) => item.includes(term) || term.includes(item)));
}

const fatCandidates: SuggestionCandidate[] = [
  {
    key: "omega3-fish", text: "Thêm cá béo như cá hồi, cá thu 1–2 bữa để có thêm Omega-3.",
    excludedDiets: ["VEGETARIAN", "VEGAN"], conflicts: ["hải sản", "thủy sản", "đồ biển", "seafood", "cá"],
  },
  {
    key: "omega3-plant", text: "Thêm Omega-3 từ thực vật: đậu nành, đậu hũ hoặc hạt óc chó.",
    conflicts: ["đậu nành", "đậu hũ", "óc chó", "các loại hạt"],
  },
  { key: "fat-plant-oil", text: "Nấu bằng dầu thực vật và giữ lượng chất béo như hiện tại." },
];

const formatGram = (value: number) => `${value.toLocaleString("vi-VN")} g`;

/** Hai gợi ý theo số liệu trung bình của thực đơn: chất xơ và chất béo; đã loại gợi ý mâu thuẫn với hồ sơ. */
export function mealPlanSuggestions(
  profile: NutritionProfile | null | undefined,
  averages: { fiber: number; fat: number },
  fatTarget: number | null,
): MealPlanSuggestion[] {
  const fiberHead = `Chất xơ trung bình ${formatGram(averages.fiber)} mỗi ngày`;
  const fiber: MealPlanSuggestion = {
    key: "fiber",
    text: averages.fiber < FIBER_TARGET_G
      ? `${fiberHead}, dưới mức ${formatGram(FIBER_TARGET_G)}: thêm 1–2 khẩu phần rau xanh mỗi ngày.`
      : `${fiberHead}, đạt mức ${formatGram(FIBER_TARGET_G)}.`,
  };
  const fatHead = fatTarget ? `Chất béo trung bình ${formatGram(averages.fat)} mỗi ngày (mục tiêu ${formatGram(fatTarget)})` : "";
  if (fatTarget && averages.fat > fatTarget) {
    return [fiber, { key: "fat-reduce", text: `${fatHead}: bớt món chiên, ưu tiên hấp, luộc, kho.` }];
  }
  const candidate = fatCandidates.find((item) => !conflictsWithProfile(item, profile))!;
  return [fiber, { key: candidate.key, text: fatHead ? `${fatHead}. ${candidate.text}` : candidate.text }];
}

/** Nhãn trung thực cho nguồn tạo thực đơn. */
export function mealPlanSourceLabel(aiGenerated: boolean) {
  return aiGenerated ? "Tạo bởi AI" : "Thuật toán gợi ý";
}

/** Nguồn sẽ dùng khi bấm "Tạo thực đơn": chỉ nhắc tới AI khi backend xác nhận đã cấu hình OpenAI. */
export function generateSourceLabel(aiAvailable: boolean | undefined) {
  return mealPlanSourceLabel(Boolean(aiAvailable));
}

export function generateMealPlanLabel(pending: boolean) {
  return pending ? "Đang tạo thực đơn..." : "Tạo thực đơn";
}
