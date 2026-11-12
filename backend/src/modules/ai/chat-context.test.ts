import { describe, expect, it } from "vitest";
import {
  answerAllergyWarnings, CHAT_HISTORY_MAX_CHARS, CHAT_HISTORY_TURNS, CHAT_PANTRY_LIMIT, chatHistoryTurns, chatMealPlanContext, chatPantryContext,
  chatProfileContext, chatSafetyContext, vietnamDateKey,
} from "./chat-context.js";

const day = (date: string, items: Array<[string, string, number, boolean]>) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  items: items.map(([mealType, dish, calories, completed]) => ({
    mealType: mealType as "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER", calories, completed, recipe: { name: dish },
  })),
});
const plan = {
  name: "Thực đơn 2/11/2026",
  days: [
    day("2026-11-01", [["LUNCH", "Phở bò", 520, true]]),
    day("2026-11-02", [["DINNER", "Cá kho tộ (kèm cơm)", 620, false], ["BREAKFAST", "Cháo gà hành gừng", 330, true], ["LUNCH", "Bún chả Hà Nội", 560, false]]),
    day("2026-11-03", [["BREAKFAST", "Xôi đậu xanh muối mè", 410, false]]),
    day("2026-11-04", [["BREAKFAST", "Bánh mì ốp la", 380, false]]),
    day("2026-11-05", [["BREAKFAST", "Sữa chua nếp cẩm", 300, false]]),
  ],
};

describe("AI chat meal plan context", () => {
  it("uses the Vietnam calendar day (UTC+7)", () => {
    expect(vietnamDateKey(new Date("2026-11-01T17:30:00.000Z"))).toBe("2026-11-02");
    expect(vietnamDateKey(new Date("2026-11-01T16:59:00.000Z"))).toBe("2026-11-01");
  });

  it("summarises today and the next days of the active plan, without ingredients", () => {
    const context = chatMealPlanContext(plan, 2000, new Date("2026-11-02T03:00:00.000Z"));
    expect(context).toEqual({
      status: "đang áp dụng",
      name: "Thực đơn 2/11/2026",
      today: "2026-11-02",
      days: [
        { date: "2026-11-02", meals: [
          { meal: "Bữa sáng", dish: "Cháo gà hành gừng", calories: 330, eaten: true },
          { meal: "Bữa trưa", dish: "Bún chả Hà Nội", calories: 560, eaten: false },
          { meal: "Bữa tối", dish: "Cá kho tộ (kèm cơm)", calories: 620, eaten: false },
        ] },
        { date: "2026-11-03", meals: [{ meal: "Bữa sáng", dish: "Xôi đậu xanh muối mè", calories: 410, eaten: false }] },
        { date: "2026-11-04", meals: [{ meal: "Bữa sáng", dish: "Bánh mì ốp la", calories: 380, eaten: false }] },
      ],
      todayCalories: { planned: 1510, eaten: 330, target: 2000 },
    });
    expect(JSON.stringify(context)).not.toMatch(/ingredient|nguyên liệu/i);
  });

  it("says clearly when there is no active plan", () => {
    expect(chatMealPlanContext(null, 2000)).toEqual({ status: "chưa có thực đơn" });
  });

  it("keeps a plan whose remaining days start later, and has no target without a profile", () => {
    const context = chatMealPlanContext(plan, null, new Date("2026-10-30T03:00:00.000Z"));
    expect(context).toMatchObject({ today: "2026-10-30", todayCalories: { planned: 0, eaten: 0, target: null } });
    expect((context as { days: Array<{ date: string }> }).days[0].date).toBe("2026-11-01");
  });

  it("drops ids and timestamps from the profile and never carries account data", () => {
    const profile = {
      id: "profile-a", userId: "user-a", createdAt: new Date(), updatedAt: new Date(), dietType: "VEGAN", allergies: ["Đậu phộng"],
      dislikedFoods: [], preferredCuisines: ["Việt Nam"], mealsPerDay: 3, dailyCalorieTarget: 1800,
      email: "demo@nouri.vn", passwordHash: "$2b$10$abc", token: "eyJhbGciOi",
    };
    const context = JSON.stringify({ profile: chatProfileContext(profile), mealPlan: chatMealPlanContext(plan, 1800, new Date("2026-11-02T03:00:00.000Z")) });
    expect(context).toContain("VEGAN");
    expect(context).not.toMatch(/profile-a|user-a|demo@nouri\.vn|passwordHash|\$2b\$|eyJhbGciOi|createdAt|updatedAt/);
    expect(chatProfileContext(null)).toBeNull();
  });
});

describe("AI chat safety context (GĐ3b-R1)", () => {
  it("expands allergy groups and dislikes into terms to avoid, and names a strict diet", () => {
    const context = chatSafetyContext({ dietType: "VEGETARIAN", allergies: ["Hải sản"], dislikedFoods: ["Hành tây"] });
    expect(context.avoidForAllergy).toEqual(expect.arrayContaining(["tôm", "cá", "nước mắm"]));
    expect(context.avoidDisliked).toEqual(["hành tây"]);
    expect(context.requiredDiet).toBe("chay");
    expect(chatSafetyContext({ dietType: "VEGAN" }).requiredDiet).toBe("thuần chay");
    expect(chatSafetyContext({ dietType: "LOW_CARB" }).requiredDiet).toBeNull();
    expect(chatSafetyContext(null)).toEqual({ avoidForAllergy: [], avoidDisliked: [], requiredDiet: null });
  });
});

describe("chatHistoryTurns, chatPantryContext", () => {
  it("chỉ gửi CHAT_HISTORY_TURNS tin gần nhất, cắt tin quá dài", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `tin ${index}` }));
    const turns = chatHistoryTurns([...messages, { role: "user", content: "x".repeat(CHAT_HISTORY_MAX_CHARS + 50) }]);
    expect(turns).toHaveLength(CHAT_HISTORY_TURNS);
    expect(turns.at(-1)?.content).toHaveLength(CHAT_HISTORY_MAX_CHARS + 1);
    expect(turns[0]).toEqual({ role: "assistant", content: "tin 5" });
  });

  it("sắp hết hạn: còn ≤ 3 ngày theo ngày lịch Việt Nam (kể cả đã quá hạn); giới hạn số thực phẩm, hạn gần trước", () => {
    const now = new Date("2026-11-12T20:00:00.000Z"); // 03:00 ngày 13/11 giờ Việt Nam
    const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
    const context = chatPantryContext([
      { name: "Gạo", quantity: 1, unit: "KG", expiryDate: day("2027-01-01") },
      { name: "Sữa", quantity: 1, unit: "L", expiryDate: day("2026-11-12") },
      { name: "Trứng", quantity: 10, unit: "ITEM", expiryDate: day("2026-11-16") },
      { name: "Muối", quantity: 1, unit: "PACKAGE", expiryDate: null },
    ], now);
    expect(context.items.map((item) => item.name)).toEqual(["Sữa", "Trứng", "Gạo", "Muối"]);
    expect(context.expiringSoon).toEqual([{ name: "Sữa", daysLeft: -1 }, { name: "Trứng", daysLeft: 3 }]);
    const many = Array.from({ length: CHAT_PANTRY_LIMIT + 5 }, (_, index) => ({ name: `M${index}`, quantity: 1, unit: "G", expiryDate: null }));
    expect(chatPantryContext(many, now).items).toHaveLength(CHAT_PANTRY_LIMIT);
  });

  it("answerAllergyWarnings: khớp nguyên từ theo nhóm dị ứng ('cá' không khớp 'các')", () => {
    expect(answerAllergyWarnings("Các món: canh cá lóc, gỏi tôm.", ["Hải sản"])).toEqual(["tôm", "cá"]);
    expect(answerAllergyWarnings("Các món rau luộc.", ["Hải sản"])).toEqual([]);
  });
});
