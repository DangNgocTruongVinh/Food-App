import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { DashboardData, MealPlanItem, PantryItem } from "../../types";
import { getDashboard } from "./dashboard.api";
import {
  buildNutritionSummary,
  daysLeft,
  daysLeftLabel,
  dashboardRecipeSearchPath,
  dashboardWaterLiters,
  DASHBOARD_MAX_WATER_GLASSES,
  expiringCountLabel,
  nextMealId,
  nextWaterGlasses,
  orderTodayMeals,
  percentOf,
  recommendationReason,
  ringDash,
  usableTargets,
} from "./dashboard.logic";
import { dashboardQueries } from "./dashboard.queries";

const pantryItem = (overrides: Partial<PantryItem> = {}): PantryItem => ({
  id: "pantry-a",
  name: "Ức gà",
  category: "Thịt",
  quantity: 500,
  unit: "G",
  storageLocation: "REFRIGERATOR",
  expiryDate: "2026-09-17T00:00:00.000Z",
  minimumStock: 0,
  note: null,
  ...overrides,
});

const recommendedRecipes: DashboardData["recommendedRecipes"] = [
  { id: "recipe-a", name: "Ức gà", calories: 450, prepMinutes: 10, cookMinutes: 20, dietTags: ["BALANCED"] },
  { id: "recipe-b", name: "Cá hồi", calories: 500, prepMinutes: 8, cookMinutes: 18, dietTags: [] },
  { id: "recipe-c", name: "Bowl rau", calories: 350, prepMinutes: 12, cookMinutes: 10, dietTags: ["VEGAN"] },
  { id: "recipe-d", name: "Yến mạch", calories: 300, prepMinutes: 5, cookMinutes: 5, dietTags: [] },
];

const dashboard: DashboardData = {
  nutritionTargets: { calories: 2000, proteinG: 100, carbsG: 220, fatG: 60 },
  pantryCount: 6,
  expiringItems: [
    pantryItem(),
    pantryItem({ id: "pantry-b", name: "Rau", expiryDate: "2026-09-14T00:00:00.000Z" }),
    pantryItem({ id: "pantry-c", name: "Cá", expiryDate: "2026-09-20T00:00:00.000Z" }),
  ],
  expiredCount: 1,
  activePlan: { id: "plan-a", name: "Thực đơn tuần", completionRate: 67 },
  recommendedRecipes,
  todayMeals: [
    {
      id: "meal-a", mealType: "BREAKFAST", calories: 600, completed: true,
      recipe: { id: "recipe-d", name: "Yến mạch", prepMinutes: 5, cookMinutes: 5 },
    },
    {
      id: "meal-b", mealType: "LUNCH", calories: 500, completed: false,
      recipe: { id: "recipe-a", name: "Ức gà", prepMinutes: 10, cookMinutes: 20 },
    },
    {
      id: "meal-c", mealType: "DINNER", calories: 1500, completed: true,
      recipe: { id: "recipe-b", name: "Cá hồi", prepMinutes: 8, cookMinutes: 18 },
    },
  ],
};

const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("sessionStorage", { getItem: () => null });
});

afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});

describe("Dashboard API and query (no network)", () => {
  it("loads the unchanged Dashboard endpoint", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: dashboard, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(getDashboard()).resolves.toEqual(dashboard);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/dashboard" });
  });

  it("propagates Dashboard API errors to React Query", async () => {
    const failure = new Error("dashboard unavailable");
    api.defaults.adapter = async () => { throw failure; };
    await expect(getDashboard()).rejects.toBe(failure);
    await expect(client.fetchQuery(dashboardQueries.overview())).rejects.toBe(failure);
  });

  it("uses the existing shared key and caches Dashboard data", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: dashboard, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    expect(queryKeys.dashboard).toEqual(["dashboard"]);
    expect(dashboardQueries.overview().queryKey).toEqual(["dashboard"]);
    await expect(client.fetchQuery(dashboardQueries.overview())).resolves.toEqual(dashboard);
    await expect(client.fetchQuery(dashboardQueries.overview())).resolves.toEqual(dashboard);
    expect(adapter).toHaveBeenCalledOnce();
  });
});

const planItem = (id: string, macros: { proteinG: number; carbsG: number; fatG: number }, servings = 1) =>
  ({ id, servings, recipe: { ...macros } }) as unknown as MealPlanItem;
const targets = { calories: 2000, proteinG: 100, carbsG: 220, fatG: 60 };

describe("today's meals", () => {
  const meals = [
    { ...dashboard.todayMeals[2] },
    { ...dashboard.todayMeals[0] },
    { ...dashboard.todayMeals[1] },
    { id: "meal-s", mealType: "SNACK" as const, calories: 150, completed: false, recipe: { id: "r-s", name: "Chè", prepMinutes: 5, cookMinutes: 0 } },
  ];

  it("orders meals by time of day: breakfast, lunch, snack, dinner", () => {
    expect(orderTodayMeals(meals).map((meal) => meal.mealType)).toEqual(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
  });

  it("picks the first not-eaten meal in that order as the next meal", () => {
    expect(nextMealId(meals)).toBe("meal-b");
    expect(nextMealId(meals.map((meal) => ({ ...meal, completed: true })))).toBeNull();
    expect(nextMealId([])).toBeNull();
  });
});

describe("nutrition summary", () => {
  it("sums calories of eaten meals and macros of their recipes × servings from the plan", () => {
    const summary = buildNutritionSummary(dashboard.todayMeals, targets, [
      planItem("meal-a", { proteinG: 20, carbsG: 60, fatG: 10 }),
      planItem("meal-b", { proteinG: 40, carbsG: 50, fatG: 15 }),
      planItem("meal-c", { proteinG: 35, carbsG: 30, fatG: 20 }, 2),
    ]);
    expect(summary.calories).toEqual({ consumed: 2100, target: 2000, percent: 105 });
    expect(summary.macros).toEqual({
      protein: { consumed: 90, target: 100, percent: 90 },
      carbs: { consumed: 120, target: 220, percent: 55 },
      fat: { consumed: 50, target: 60, percent: 83 },
    });
    expect(summary.plannedCalories).toBe(2600);
    expect(summary.remainingAfterPlan).toBe(-600);
  });

  it("leaves macros empty until the plan detail is loaded, and is zero-safe without meals", () => {
    expect(buildNutritionSummary(dashboard.todayMeals, targets).macros).toBeNull();
    const empty = buildNutritionSummary([], targets, []);
    expect(empty.calories).toEqual({ consumed: 0, target: 2000, percent: 0 });
    expect(empty.macros?.protein).toEqual({ consumed: 0, target: 100, percent: 0 });
    expect(empty.plannedCalories).toBe(0);
  });

  it("uses targets only when the profile has a calorie target", () => {
    expect(usableTargets(null)).toBeNull();
    expect(usableTargets({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
    expect(usableTargets(dashboard.nutritionTargets)).toEqual({ calories: 2000, proteinG: 100, carbsG: 220, fatG: 60 });
    expect(percentOf(5, 0)).toBe(0);
  });

  it("draws the calorie ring proportionally, capped at a full circle", () => {
    const half = ringDash(50, 52);
    expect(half.offset).toBeCloseTo(half.circumference / 2, 6);
    expect(ringDash(140, 52).offset).toBe(0);
    expect(ringDash(-5, 52).offset).toBeCloseTo(ringDash(0, 52).circumference, 6);
  });
});

describe("pantry snapshot", () => {
  const now = new Date("2026-09-15T08:00:00");

  it("counts calendar days left and words them in Vietnamese", () => {
    expect(daysLeft("2026-09-17T00:00:00", now)).toBe(2);
    expect(daysLeft(null, now)).toBeNull();
    expect([daysLeftLabel(3), daysLeftLabel(0), daysLeftLabel(-1), daysLeftLabel(null)])
      .toEqual(["Còn 3 ngày", "Hết hạn hôm nay", "Đã hết hạn", "Chưa có hạn sử dụng"]);
  });

  it("shows 5+ when the API list (max 5 items) is full", () => {
    expect([expiringCountLabel(0), expiringCountLabel(4), expiringCountLabel(5)]).toEqual(["0", "4", "5+"]);
  });
});

describe("recommendation wording (from real data only)", () => {
  it("explains the suggested dish by expiring ingredients, then pantry ingredients, then the profile", () => {
    expect(recommendationReason({ expiringIngredientCount: 2, pantryIngredientCount: 3 }, true)).toBe("Dùng 2 nguyên liệu sắp hết hạn trong tủ bếp của bạn.");
    expect(recommendationReason({ expiringIngredientCount: 0, pantryIngredientCount: 3 }, true)).toBe("Dùng 3 nguyên liệu bạn đang có trong tủ bếp.");
    expect(recommendationReason({}, true)).toBe("Hợp với chế độ ăn, dị ứng và món không thích trong hồ sơ của bạn.");
    expect(recommendationReason({}, false)).toBeNull();
  });
});

describe("search and water", () => {
  it("keeps the Recipes search path and blank-search behavior", () => {
    expect(dashboardRecipeSearchPath("  ức gà ")).toBe(`/recipes?q=${encodeURIComponent("ức gà")}`);
    expect(dashboardRecipeSearchPath("   ")).toBeNull();
  });

  it("converts glasses to liters and adds one glass up to the maximum", () => {
    expect(dashboardWaterLiters(5)).toBe(1.25);
    expect(nextWaterGlasses(0)).toBe(1);
    expect(nextWaterGlasses(DASHBOARD_MAX_WATER_GLASSES)).toBe(DASHBOARD_MAX_WATER_GLASSES);
  });
});
