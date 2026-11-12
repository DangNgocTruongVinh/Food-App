import type { ProfileResponse } from "../../types";
import type { ProfileFormValues } from "./profile.api";

// Giới hạn khớp backend (profile.schema.ts): kiểm tra trước khi gửi để báo lỗi ngay dưới từng trường.
export const PROFILE_LIMITS = {
  name: { min: 2, max: 80 },
  age: { min: 13, max: 120 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 25, max: 400 },
  listItemMax: 60,
  allergies: 30,
  dislikedFoods: 30,
  preferredCuisines: 20,
} as const;

export const GENDER_OPTIONS = [["FEMALE", "Nữ"], ["MALE", "Nam"], ["OTHER", "Khác"]] as const;
export const GOAL_OPTIONS = [["LOSE_WEIGHT", "Giảm cân"], ["MAINTAIN", "Giữ cân"], ["GAIN_WEIGHT", "Tăng cân"], ["BUILD_MUSCLE", "Tăng cơ"]] as const;
export const DIET_OPTIONS = [
  ["BALANCED", "Cân bằng"], ["VEGETARIAN", "Ăn chay"], ["VEGAN", "Thuần chay"], ["LOW_CARB", "Ít tinh bột"], ["HIGH_PROTEIN", "Giàu đạm"],
] as const;
export const MEALS_OPTIONS = [["3", "3 bữa chính"], ["4", "3 bữa chính + 1 bữa phụ"]] as const;
export const ACTIVITY_OPTIONS = [
  ["SEDENTARY", "Ít vận động, chủ yếu ngồi"],
  ["LIGHT", "Nhẹ, 1–3 buổi mỗi tuần"],
  ["MODERATE", "Vừa, 3–5 buổi mỗi tuần"],
  ["ACTIVE", "Nhiều, 6–7 buổi mỗi tuần"],
  ["VERY_ACTIVE", "Rất nhiều, cường độ cao"],
] as const;
/** Gợi ý nhanh cho ô ẩm thực ưa thích: đúng các nền ẩm thực có trong bộ món. */
export const CUISINE_SUGGESTIONS = ["Việt Nam", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Ý", "Hy Lạp", "Mỹ"];

export const emptyProfileForm: ProfileFormValues = {
  name: "", age: "", gender: "FEMALE", heightCm: "", weightKg: "", targetWeightKg: "",
  activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED", mealsPerDay: "3",
  allergies: [], dislikedFoods: [], preferredCuisines: [],
};

/** Giá trị form từ dữ liệu hồ sơ đã lưu. */
export function toProfileForm(data: ProfileResponse): ProfileFormValues {
  const profile = data.profile;
  const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    name: data.name,
    age: text(profile?.age),
    gender: profile?.gender ?? "FEMALE",
    heightCm: text(profile?.heightCm),
    weightKg: text(profile?.weightKg),
    targetWeightKg: text(profile?.targetWeightKg),
    activityLevel: profile?.activityLevel ?? "MODERATE",
    goal: profile?.goal ?? "MAINTAIN",
    dietType: profile?.dietType ?? "BALANCED",
    mealsPerDay: String(profile?.mealsPerDay ?? 3),
    allergies: profile?.allergies ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    preferredCuisines: profile?.preferredCuisines ?? [],
  };
}

export function isProfileDirty(form: ProfileFormValues, saved: ProfileFormValues) {
  return JSON.stringify(form) !== JSON.stringify(saved);
}

/** Thêm một thẻ (dị ứng, món không thích, ẩm thực): bỏ khoảng trắng thừa, không trùng (không phân biệt hoa thường). */
export function addTag(tags: string[], raw: string, max: number) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { tags, error: null };
  if (value.length > PROFILE_LIMITS.listItemMax) return { tags, error: `Rút gọn còn tối đa ${PROFILE_LIMITS.listItemMax} ký tự.` };
  if (tags.some((tag) => tag.toLocaleLowerCase("vi") === value.toLocaleLowerCase("vi"))) return { tags, error: `“${value}” đã có trong danh sách.` };
  if (tags.length >= max) return { tags, error: `Tối đa ${max} mục. Bỏ bớt một mục rồi thêm lại.` };
  return { tags: [...tags, value], error: null };
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

function numberError(value: string, { min, max }: { min: number; max: number }, unit: string, integer = false) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < min || number > max) {
    return `Nhập ${integer ? "số nguyên " : "số "}từ ${min} đến ${max}${unit}, hoặc để trống.`;
  }
  return undefined;
}

/** Lỗi theo từng trường, cùng giới hạn với backend; trường số để trống là hợp lệ (dùng giá trị mặc định khi tính). */
export function validateProfileForm(form: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const name = form.name.trim();
  if (name.length < PROFILE_LIMITS.name.min || name.length > PROFILE_LIMITS.name.max) {
    errors.name = `Nhập họ tên từ ${PROFILE_LIMITS.name.min} đến ${PROFILE_LIMITS.name.max} ký tự.`;
  }
  errors.age = numberError(form.age, PROFILE_LIMITS.age, " tuổi", true);
  errors.heightCm = numberError(form.heightCm, PROFILE_LIMITS.heightCm, " cm");
  errors.weightKg = numberError(form.weightKg, PROFILE_LIMITS.weightKg, " kg");
  errors.targetWeightKg = numberError(form.targetWeightKg, PROFILE_LIMITS.weightKg, " kg");
  if (form.mealsPerDay !== "3" && form.mealsPerDay !== "4") errors.mealsPerDay = "Chọn 3 hoặc 4 bữa mỗi ngày.";
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value)) as ProfileFormErrors;
}

/** Chỉ số khối cơ thể từ số đo trong form; thiếu số đo thì null. */
export function bodyMassIndex(form: Pick<ProfileFormValues, "heightCm" | "weightKg">) {
  const height = Number(form.heightCm) / 100;
  const weight = Number(form.weightKg);
  return height > 0 && weight > 0 ? Math.round((weight / (height * height)) * 10) / 10 : null;
}

export const EXPIRY_DAY_OPTIONS = [["1", "1 ngày"], ["2", "2 ngày"], ["3", "3 ngày"]] as const;

/** Thông báo sau "Gửi thử ngay": máy chủ chưa có SMTP thì email chỉ được ghi vào log. */
export function testEmailMessage(result: { emailConfigured: boolean; remainingToday: number }) {
  const left = `Còn ${result.remainingToday} lần gửi thử hôm nay.`;
  return result.emailConfigured
    ? `Đã gửi email thử tới hộp thư của bạn. ${left}`
    : `Máy chủ chưa cấu hình email nên nội dung chỉ được ghi vào log máy chủ. ${left}`;
}
