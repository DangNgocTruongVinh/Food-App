import { describe, expect, it } from "vitest";
import type { ProfileResponse } from "../../types";
import {
  addTag, bodyMassIndex, emptyProfileForm, isProfileDirty, PROFILE_LIMITS, testEmailMessage, toProfileForm, validateProfileForm,
} from "./profile.logic";

const saved: ProfileResponse = {
  id: "user-a", name: "Minh Anh", email: "demo@nouri.vn",
  profile: {
    age: 28, gender: "FEMALE", heightCm: 160, weightKg: 52, targetWeightKg: undefined, activityLevel: "LIGHT", goal: "MAINTAIN",
    dietType: "VEGAN", allergies: ["Đậu phộng"], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam"], mealsPerDay: 4,
    dailyCalorieTarget: 1800, proteinTargetG: 113, carbTargetG: 211, fatTargetG: 56,
  },
};

describe("Profile form", () => {
  it("loads the saved profile, blank numbers as empty strings", () => {
    expect(toProfileForm(saved)).toEqual({
      name: "Minh Anh", age: "28", gender: "FEMALE", heightCm: "160", weightKg: "52", targetWeightKg: "", activityLevel: "LIGHT",
      goal: "MAINTAIN", dietType: "VEGAN", mealsPerDay: "4", allergies: ["Đậu phộng"], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam"],
    });
    expect(toProfileForm({ ...saved, profile: null })).toEqual({ ...emptyProfileForm, name: "Minh Anh" });
  });

  it("knows when there are unsaved changes", () => {
    const form = toProfileForm(saved);
    expect(isProfileDirty(form, toProfileForm(saved))).toBe(false);
    expect(isProfileDirty({ ...form, allergies: [...form.allergies, "Tôm"] }, toProfileForm(saved))).toBe(true);
  });

  it("validates each field with the backend limits and says how to fix it", () => {
    expect(validateProfileForm(toProfileForm(saved))).toEqual({});
    expect(validateProfileForm({ ...emptyProfileForm, name: "Minh" })).toEqual({});
    const errors = validateProfileForm({ ...emptyProfileForm, name: " A ", age: "12.5", heightCm: "90", weightKg: "abc", targetWeightKg: "401", mealsPerDay: "5" });
    expect(errors).toEqual({
      name: "Nhập họ tên từ 2 đến 80 ký tự.",
      age: "Nhập số nguyên từ 13 đến 120 tuổi, hoặc để trống.",
      heightCm: "Nhập số từ 100 đến 250 cm, hoặc để trống.",
      weightKg: "Nhập số từ 25 đến 400 kg, hoặc để trống.",
      targetWeightKg: "Nhập số từ 25 đến 400 kg, hoặc để trống.",
      mealsPerDay: "Chọn 3 hoặc 4 bữa mỗi ngày.",
    });
  });

  it("adds tags trimmed, without duplicates and within the limits", () => {
    expect(addTag(["Tôm"], "  Đậu   phộng ", 30)).toEqual({ tags: ["Tôm", "Đậu phộng"], error: null });
    expect(addTag(["Tôm"], "   ", 30)).toEqual({ tags: ["Tôm"], error: null });
    expect(addTag(["Tôm"], "TÔM", 30).error).toBe("“TÔM” đã có trong danh sách.");
    expect(addTag(["a", "b"], "c", 2).error).toBe("Tối đa 2 mục. Bỏ bớt một mục rồi thêm lại.");
    expect(addTag([], "x".repeat(PROFILE_LIMITS.listItemMax + 1), 30).error).toBe("Rút gọn còn tối đa 60 ký tự.");
  });

  it("computes BMI only when height and weight are known", () => {
    expect(bodyMassIndex({ heightCm: "160", weightKg: "52" })).toBe(20.3);
    expect(bodyMassIndex({ heightCm: "", weightKg: "52" })).toBeNull();
  });
});

describe("Nhắc đồ sắp hết hạn: thông báo gửi thử", () => {
  it("nói rõ email đã gửi hay chỉ ghi log (chưa cấu hình SMTP), kèm số lần còn lại", () => {
    expect(testEmailMessage({ emailConfigured: true, remainingToday: 2 })).toBe("Đã gửi email thử tới hộp thư của bạn. Còn 2 lần gửi thử hôm nay.");
    expect(testEmailMessage({ emailConfigured: false, remainingToday: 0 })).toContain("chỉ được ghi vào log máy chủ. Còn 0 lần");
  });
});
