import type { MealType } from "@prisma/client";
import { expandRestrictedTerms } from "../../services/dietary.service.js";

// Ngữ cảnh gửi cho trợ lý AI: chỉ những trường cần cho câu trả lời, không có id, email, mật khẩu hay token.

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
export const CHAT_PLAN_DAYS = 3;

const MEAL_LABELS: Record<MealType, string> = { BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", SNACK: "Bữa phụ", DINNER: "Bữa tối" };
const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

type ProfileInput = {
  age?: number | null; gender?: string | null; heightCm?: number | null; weightKg?: number | null; targetWeightKg?: number | null;
  activityLevel?: string | null; goal?: string | null; dietType?: string | null; allergies?: string[]; dislikedFoods?: string[];
  preferredCuisines?: string[]; mealsPerDay?: number | null; dailyCalorieTarget?: number | null; proteinTargetG?: number | null;
  carbTargetG?: number | null; fatTargetG?: number | null;
};

type PlanInput = {
  name: string;
  days: Array<{ date: Date; items: Array<{ mealType: MealType; calories: number; completed: boolean; recipe: { name: string } }> }>;
};

/** Hồ sơ dinh dưỡng rút gọn (bỏ id, userId, thời điểm tạo/sửa). */
export function chatProfileContext(profile: ProfileInput | null) {
  if (!profile) return null;
  const {
    age, gender, heightCm, weightKg, targetWeightKg, activityLevel, goal, dietType, allergies, dislikedFoods, preferredCuisines,
    mealsPerDay, dailyCalorieTarget, proteinTargetG, carbTargetG, fatTargetG,
  } = profile;
  return {
    age, gender, heightCm, weightKg, targetWeightKg, activityLevel, goal, dietType, allergies, dislikedFoods, preferredCuisines,
    mealsPerDay, dailyCalorieTarget, proteinTargetG, carbTargetG, fatTargetG,
  };
}

/**
 * Ràng buộc an toàn gửi kèm câu hỏi (GĐ3b-R1): các cụm thành phần phải tránh (dị ứng mở rộng theo nhóm, vd. "Hải sản" → tôm, cá,
 * nước mắm…; món không thích) và yêu cầu chay/thuần chay. Lời nhắc hệ thống cấm gợi ý món chứa chúng.
 */
export function chatSafetyContext(profile: Pick<ProfileInput, "dietType" | "allergies" | "dislikedFoods"> | null) {
  const strictDiet = profile?.dietType === "VEGAN" || profile?.dietType === "VEGETARIAN" ? profile.dietType : null;
  return {
    avoidForAllergy: expandRestrictedTerms(profile?.allergies ?? []),
    avoidDisliked: expandRestrictedTerms(profile?.dislikedFoods ?? []),
    requiredDiet: strictDiet === "VEGAN" ? "thuần chay" : strictDiet === "VEGETARIAN" ? "chay" : null,
  };
}

/** Ngày hôm nay theo giờ Việt Nam (yyyy-MM-dd); ngày trong thực đơn lưu 00:00 UTC của ngày lịch. */
export function vietnamDateKey(instant: Date) {
  return new Date(instant.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Tóm tắt thực đơn đang áp dụng: các bữa hôm nay và vài ngày tới (tên món, bữa, calo, đã ăn hay chưa),
 * tổng calo hôm nay so với mục tiêu. Không gửi nguyên liệu. Không có thực đơn thì ghi rõ "chưa có thực đơn".
 */
export function chatMealPlanContext(plan: PlanInput | null, calorieTarget: number | null | undefined, now = new Date()) {
  if (!plan) return { status: "chưa có thực đơn" as const };
  const today = vietnamDateKey(now);
  const days = [...plan.days]
    .map((day) => ({ ...day, key: day.date.toISOString().slice(0, 10) }))
    .filter((day) => day.key >= today)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, CHAT_PLAN_DAYS);
  const todayItems = days.find((day) => day.key === today)?.items ?? [];
  const sum = (items: PlanInput["days"][number]["items"]) => items.reduce((total, item) => total + item.calories, 0);
  return {
    status: "đang áp dụng" as const,
    name: plan.name,
    today,
    days: days.map((day) => ({
      date: day.key,
      meals: [...day.items]
        .sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType))
        .map((item) => ({ meal: MEAL_LABELS[item.mealType], dish: item.recipe.name, calories: item.calories, eaten: item.completed })),
    })),
    todayCalories: {
      planned: sum(todayItems),
      eaten: sum(todayItems.filter((item) => item.completed)),
      target: calorieTarget ?? null,
    },
  };
}
