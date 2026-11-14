import type { MealPlanJob, PlanFallbackReason } from "./meal-plans.api";
import type { MealPlan, MealPlanDay, MealPlanItem, MealPlanStatus, MealType, NutritionProfile, ShoppingItem } from "../../types";

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

/**
 * Bữa vi phạm hồ sơ hiện tại (thực đơn tạo trước khi người dùng thêm dị ứng/đổi chế độ ăn, GĐ3b-R2): cảnh báo, và
 * nút "Đổi món" khi bữa chưa ăn. Thực đơn tạo sau đã lọc theo hồ sơ nên không có bữa vi phạm.
 */
export function mealViolation(item: Pick<MealPlanItem, "completed" | "recipe">) {
  const fit = item.recipe.fit;
  if (!fit || fit.safe) return null;
  return { warnings: fit, canSwap: !item.completed };
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

/** Danh sách đi chợ theo nhóm (thứ tự nhóm của danh mục, nhóm lạ xếp cuối), trong nhóm: chưa mua trước, rồi theo tên. */
export function groupShoppingItems<T extends Pick<ShoppingItem, "name" | "purchased"> & { category?: string | null }>(items: T[], categories: string[]) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    // Nhóm do backend gán (services/food-category.ts, luôn có); thiếu thì nhóm cuối của danh mục (nhóm mặc định).
    const group = item.category?.trim() || categories[categories.length - 1] || "";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  });
  const rank = (group: string) => {
    const index = categories.indexOf(group);
    return index < 0 ? categories.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "vi"))
    .map(([name, groupItems]) => ({
      name,
      items: [...groupItems].sort((a, b) => Number(a.purchased) - Number(b.purchased) || a.name.localeCompare(b.name, "vi")),
    }));
}

/** Nhãn trung thực cho nguồn tạo thực đơn. */
export function mealPlanSourceLabel(aiGenerated: boolean) {
  return aiGenerated ? "Tạo bởi AI" : "Thuật toán gợi ý";
}

const FALLBACK_TEXT: Record<PlanFallbackReason, string> = {
  AI_NOT_CONFIGURED: "máy chủ chưa cấu hình AI",
  AI_TIMEOUT: "AI quá 2 phút chưa trả lời",
  AI_ERROR: "AI đang gặp lỗi",
  AI_INVALID: "kết quả AI không hợp lệ",
};

/** Số giây đã chạy của việc nền (không âm khi lệch đồng hồ). */
export function aiJobElapsedSeconds(job: Pick<MealPlanJob, "startedAt">, now: number) {
  return Math.max(0, Math.round((now - Date.parse(job.startedAt)) / 1000));
}

/** Nội dung thông báo của việc "Tạo bằng AI" theo trạng thái. */
export function aiJobMessage(job: MealPlanJob, now: number) {
  if (job.status === "RUNNING") {
    const seconds = aiJobElapsedSeconds(job, now);
    const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    return `Đang tạo thực đơn bằng AI (đã chạy ${elapsed}, thường 1–2 phút). Bạn có thể rời trang, Nouri sẽ gửi thông báo khi xong.`;
  }
  if (job.status === "FAILED") return job.error ?? "Chưa tạo được thực đơn. Hãy thử lại.";
  return job.fallbackReason
    ? `Không dùng được AI (${FALLBACK_TEXT[job.fallbackReason]}) nên Nouri đã tạo thực đơn bằng thuật toán.`
    : "Thực đơn AI đã sẵn sàng.";
}

/** Tiến trình ước tính 0–95% theo thời gian (AI không báo tiến độ thật; tối đa 120 giây rồi chuyển thuật toán). */
export function aiJobProgress(job: Pick<MealPlanJob, "startedAt">, now: number) {
  return Math.min(95, Math.round((aiJobElapsedSeconds(job, now) / 120) * 100));
}

export function generateMealPlanLabel(pending: boolean) {
  return pending ? "Đang tạo thực đơn..." : "Tạo thực đơn";
}
