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
};
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
  mocks.findPantry.mockResolvedValue([pantryItem]);
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
    expect(mocks.findRecipes).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      take: 3,
      select: {
        id: true,
        name: true,
        calories: true,
        prepMinutes: true,
        cookMinutes: true,
        dietTags: true,
      },
    });
  });

  it("keeps the existing response shape and derived meal-plan values", async () => {
    const result = await getDashboard(userId, now);
    expect(result).toEqual({
      nutritionTargets: { calories: 1900, proteinG: 100, carbsG: 220, fatG: 60 },
      pantryCount: 6,
      expiringItems: [pantryItem],
      expiredCount: 2,
      recommendedRecipes: [recipe],
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
    mocks.findPantry.mockResolvedValue([]);
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
