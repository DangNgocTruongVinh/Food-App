import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import dashboardRoutes from "./dashboard.routes.js";
import { getDashboard } from "./dashboard.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findProfile: vi.fn(),
  countPantry: vi.fn(),
  findPantry: vi.fn(),
  findPlan: vi.fn(),
  findRecipes: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    nutritionProfile: { findUnique: mocks.findProfile },
    pantryItem: { count: mocks.countPantry, findMany: mocks.findPantry },
    mealPlan: { findFirst: mocks.findPlan },
    recipe: { findMany: mocks.findRecipes },
  },
}));

const app = testApp("/api/dashboard", dashboardRoutes);
const userId = "cm11111111111111111111111";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "member@nouri.vn" }, mocks.secret)}`;
const now = new Date("2026-09-15T08:00:00.000Z");
const inSevenDays = new Date("2026-09-22T08:00:00.000Z");
const profile = {
  userId,
  dailyCalorieTarget: 1900,
  proteinTargetG: 100,
  carbTargetG: 220,
  fatTargetG: 60,
};
const pantryItem = {
  id: "pantry-a",
  userId,
  name: "Ức gà",
  quantity: 500,
  expiryDate: new Date("2026-09-17T00:00:00.000Z"),
};
const recipe = {
  id: "recipe-a",
  name: "Ức gà rau củ",
  calories: 450,
  prepMinutes: 10,
  cookMinutes: 20,
  dietTags: ["BALANCED"],
  imageUrl: "/assets/nutrition-hero.jpg",
  ingredients: [{ name: "Ức gà", quantity: 150, unit: "G" }, { name: "Cà rốt", quantity: 50, unit: "G" }],
};
// Món gợi ý trả về cho frontend: thông tin món + số nguyên liệu trong kho / sắp hết hạn.
const recommended = {
  id: "recipe-a", name: "Ức gà rau củ", calories: 450, prepMinutes: 10, cookMinutes: 20, dietTags: ["BALANCED"],
  imageUrl: "/assets/nutrition-hero.jpg", totalIngredients: 2, pantryIngredientCount: 1, expiringIngredientCount: 1,
};
const fullPantry = [{ ...pantryItem, unit: "G" }];
const meal = (id: string, completed: boolean, calories = 450) => ({
  id,
  mealType: "LUNCH",
  calories,
  completed,
  recipe: { ...recipe, description: "Món cân bằng", instructions: ["Áp chảo"] },
});
const activePlan = {
  id: "plan-a",
  name: "Thực đơn tuần",
  days: [
    { id: "day-today", date: new Date("2026-09-15T00:00:00.000Z"), items: [meal("meal-a", true), meal("meal-b", false, 400)] },
    { id: "day-other", date: new Date("2026-09-16T00:00:00.000Z"), items: [meal("meal-c", true, 500)] },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findProfile.mockResolvedValue(profile);
  mocks.countPantry.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
  // Truy vấn kho có điều kiện hạn dùng là danh sách "sắp hết hạn"; truy vấn còn lại là toàn bộ kho để xếp gợi ý.
  mocks.findPantry.mockImplementation(({ where }) => Promise.resolve(where.expiryDate ? [pantryItem] : fullPantry));
  mocks.findPlan.mockResolvedValue(activePlan);
  mocks.findRecipes.mockResolvedValue([recipe]);
});

describe("Dashboard service contract (mock Prisma, no database)", () => {
  it("loads all existing Dashboard sources with the token owner's id", async () => {
    await getDashboard(userId, now);
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.countPantry).toHaveBeenNthCalledWith(1, { where: { userId, quantity: { gt: 0 } } });
    expect(mocks.findPantry).toHaveBeenCalledWith({
      where: {
        userId,
        quantity: { gt: 0 },
        expiryDate: { gte: now, lte: inSevenDays },
      },
      orderBy: { expiryDate: "asc" },
      take: 5,
    });
    expect(mocks.countPantry).toHaveBeenNthCalledWith(2, {
      where: { userId, quantity: { gt: 0 }, expiryDate: { lt: now } },
    });
    expect(mocks.findPlan).toHaveBeenCalledWith({
      where: {
        userId,
        status: "ACTIVE",
        startDate: { lte: inSevenDays },
        endDate: { gte: now },
      },
      include: { days: { include: { items: { include: { recipe: true } } } } },
      orderBy: { startDate: "desc" },
    });
    expect(mocks.findRecipes).toHaveBeenCalledWith({ where: { hiddenAt: null }, orderBy: { createdAt: "asc" }, include: { ingredients: true } });
    expect(mocks.findPantry).toHaveBeenCalledWith({ where: { userId, quantity: { gt: 0 } } });
  });

  it("keeps the existing response shape and derived meal-plan values", async () => {
    const result = await getDashboard(userId, now);
    expect(result).toEqual({
      nutritionTargets: { calories: 1900, proteinG: 100, carbsG: 220, fatG: 60 },
      pantryCount: 6,
      expiringItems: [pantryItem],
      expiredCount: 2,
      recommendedRecipes: [recommended],
      activePlan: { id: "plan-a", name: "Thực đơn tuần", completionRate: 67 },
      todayMeals: [
        {
          id: "meal-a",
          mealType: "LUNCH",
          calories: 450,
          completed: true,
          recipe: { id: "recipe-a", name: "Ức gà rau củ", prepMinutes: 10, cookMinutes: 20 },
        },
        {
          id: "meal-b",
          mealType: "LUNCH",
          calories: 400,
          completed: false,
          recipe: { id: "recipe-a", name: "Ức gà rau củ", prepMinutes: 10, cookMinutes: 20 },
        },
      ],
    });
  });

  it("keeps null profile/plan and empty values when related data is absent", async () => {
    mocks.findProfile.mockResolvedValue(null);
    mocks.countPantry.mockReset().mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mocks.findPantry.mockReset().mockResolvedValue([]);
    mocks.findPlan.mockResolvedValue(null);
    mocks.findRecipes.mockResolvedValue([]);
    await expect(getDashboard(userId, now)).resolves.toEqual({
      nutritionTargets: null,
      pantryCount: 0,
      expiringItems: [],
      expiredCount: 0,
      recommendedRecipes: [],
      activePlan: null,
      todayMeals: [],
    });
  });

  it("keeps a zero completion rate for an active plan without meals", async () => {
    mocks.findPlan.mockResolvedValue({ id: "plan-empty", name: "Trống", days: [] });
    const result = await getDashboard(userId, now);
    expect(result.activePlan).toEqual({ id: "plan-empty", name: "Trống", completionRate: 0 });
    expect(result.todayMeals).toEqual([]);
  });
});

describe("Dashboard recommendations follow the profile and pantry", () => {
  const ing = (name: string) => ({ name, quantity: 100, unit: "G" });
  const dish = (id: string, dietTags: string[], ingredients: string[]) => ({
    ...recipe, id, name: id, dietTags, ingredients: ingredients.map(ing),
  });
  const pantryRow = (name: string, expiryDate: string | null) => ({ ...pantryItem, name, unit: "G", expiryDate: expiryDate ? new Date(expiryDate) : null });
  const recommendedIds = async () => (await getDashboard(userId, now)).recommendedRecipes.map((item) => item.id);

  it("only considers recipes that are not hidden (discontinued)", async () => {
    await getDashboard(userId, now);
    expect(mocks.findRecipes.mock.calls[0][0].where).toEqual({ hiddenAt: null });
  });

  it("excludes dishes that break a vegetarian diet, an allergy or a disliked food", async () => {
    mocks.findProfile.mockResolvedValue({ ...profile, dietType: "VEGETARIAN", allergies: ["Đậu phộng"], dislikedFoods: ["nấm"] });
    mocks.findRecipes.mockResolvedValue([
      dish("pho-bo", ["BALANCED"], ["Thịt bò", "Bánh phở"]),
      dish("goi-chay", ["VEGETARIAN", "VEGAN"], ["Đậu phộng", "Bún tươi"]),
      dish("nam-kho", ["VEGETARIAN", "VEGAN"], ["Nấm rơm"]),
      dish("dau-hu", ["VEGETARIAN", "VEGAN"], ["Đậu hũ", "Cà chua"]),
    ]);
    expect(await recommendedIds()).toEqual(["dau-hu"]);
  });

  it("puts dishes using soon-expiring ingredients first, then dishes using more pantry ingredients", async () => {
    mocks.findRecipes.mockResolvedValue([
      dish("no-pantry", ["BALANCED"], ["Tôm"]),
      dish("two-in-pantry", ["BALANCED"], ["Gạo", "Trứng"]),
      dish("uses-expiring", ["BALANCED"], ["Ức gà", "Hành lá"]),
      dish("one-in-pantry", ["BALANCED"], ["Gạo", "Hành tây"]),
    ]);
    const pantry = [
      pantryRow("Ức gà", "2026-09-17T00:00:00.000Z"),
      pantryRow("Gạo", "2026-12-01T00:00:00.000Z"),
      pantryRow("Trứng", null),
    ];
    mocks.findPantry.mockImplementation(({ where }) => Promise.resolve(where.expiryDate ? [] : pantry));
    const result = (await getDashboard(userId, now)).recommendedRecipes;
    expect(result.map((item) => item.id)).toEqual(["uses-expiring", "two-in-pantry", "one-in-pantry"]);
    expect(result[0]).toMatchObject({ totalIngredients: 2, pantryIngredientCount: 1, expiringIngredientCount: 1 });
    expect(result[1]).toMatchObject({ totalIngredients: 2, pantryIngredientCount: 2, expiringIngredientCount: 0 });
  });

  it("does not count expired pantry items as available", async () => {
    mocks.findRecipes.mockResolvedValue([dish("uses-expired", ["BALANCED"], ["Sữa tươi"])]);
    mocks.findPantry.mockImplementation(({ where }) => Promise.resolve(where.expiryDate ? [] : [pantryRow("Sữa tươi", "2026-09-10T00:00:00.000Z")]));
    expect((await getDashboard(userId, now)).recommendedRecipes[0]).toMatchObject({ pantryIngredientCount: 0, expiringIngredientCount: 0 });
  });
});

describe("Dashboard HTTP contract", () => {
  it("returns Dashboard data for the authenticated user and ignores spoofed query ownership", async () => {
    mocks.findPlan.mockResolvedValue(null);
    const response = await request(app, "/api/dashboard?userId=another-user", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ pantryCount: 6, expiredCount: 2, activePlan: null });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
  });

  it("requires authentication", async () => {
    const response = await request(app, "/api/dashboard");
    expect(response.status).toBe(401);
    expect(mocks.findProfile).not.toHaveBeenCalled();
  });

  it("uses the shared 500 response when a Dashboard dependency fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findProfile.mockRejectedValue(new Error("database unavailable"));
    const response = await request(app, "/api/dashboard", { token: token() });
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });
});
