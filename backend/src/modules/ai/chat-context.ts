import type { MealType } from "@prisma/client";
import { expandRestrictedTerms, findRestrictedTerms } from "../../services/dietary.service.js";

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

/** Số tin gần nhất gửi kèm làm ngữ cảnh (3 lượt hỏi–đáp) và độ dài tối đa mỗi tin: đủ cho câu hỏi nối tiếp, giữ chi phí thấp. */
export const CHAT_HISTORY_TURNS = 6;
export const CHAT_HISTORY_MAX_CHARS = 600;
/** Kho gửi kèm tối đa bao nhiêu thực phẩm (ưu tiên hạn gần nhất) và ngưỡng "sắp hết hạn". */
export const CHAT_PANTRY_LIMIT = 40;
export const EXPIRING_SOON_DAYS = 3;

type PantryInput = { name: string; quantity: number; unit: string; expiryDate: Date | null };

/**
 * Kho rút gọn: tối đa CHAT_PANTRY_LIMIT thực phẩm, hạn gần trước; expiringSoon tách riêng đồ còn ≤ 3 ngày (theo ngày lịch
 * giờ Việt Nam, đã quá hạn thì daysLeft âm) để AI ưu tiên dùng trước.
 */
export function chatPantryContext(pantry: PantryInput[], now = new Date()) {
  const today = Date.parse(`${vietnamDateKey(now)}T00:00:00.000Z`);
  const daysLeft = (date: Date | null) => (date ? Math.round((Date.parse(date.toISOString().slice(0, 10)) - today) / 86_400_000) : null);
  const sorted = [...pantry].sort((a, b) => (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity));
  const items = sorted.slice(0, CHAT_PANTRY_LIMIT).map((item) => ({
    name: item.name, quantity: item.quantity, unit: item.unit, daysLeft: daysLeft(item.expiryDate),
  }));
  return {
    items,
    expiringSoon: items.filter((item) => item.daysLeft !== null && item.daysLeft <= EXPIRING_SOON_DAYS)
      .map(({ name, daysLeft }) => ({ name, daysLeft })),
  };
}

/** N tin gần nhất (cũ → mới), mỗi tin cắt ở CHAT_HISTORY_MAX_CHARS ký tự. */
export function chatHistoryTurns(messages: Array<{ role: string; content: string }>) {
  return messages.slice(-CHAT_HISTORY_TURNS).map((message) => ({
    role: message.role === "assistant" ? "assistant" as const : "user" as const,
    content: message.content.length > CHAT_HISTORY_MAX_CHARS ? `${message.content.slice(0, CHAT_HISTORY_MAX_CHARS)}…` : message.content,
  }));
}

/** Kiểm câu trả lời sau khi nhận: các thành phần dị ứng (đã mở rộng theo nhóm) có xuất hiện trong nội dung không. */
export function answerAllergyWarnings(answer: string, allergies: string[]) {
  return findRestrictedTerms({ name: answer, ingredients: [] }, expandRestrictedTerms(allergies));
}
