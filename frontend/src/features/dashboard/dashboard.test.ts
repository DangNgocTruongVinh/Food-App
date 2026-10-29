import type { QueryClient } from "@tanstack/react-query";
import { Moon, Sun, Sunrise } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { DashboardData, PantryItem } from "../../types";
import { getDashboard } from "./dashboard.api";
import {
  buildDashboardViewModel,
  dashboardFallbackRecipes,
  dashboardMealIcon,
  dashboardMealImage,
  dashboardMealLabels,
  dashboardMealTimes,
  dashboardRecipeSearchPath,
  dashboardSuggestionImages,
  dashboardWaterLiters,
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

describe("Dashboard derived view data", () => {
  it("keeps real Dashboard data and derives current progress values", () => {
    const view = buildDashboardViewModel(dashboard, "Nguyễn Minh An", new Date("2026-09-15T09:00:00.000Z"));
    expect(view.todayMeals).toBe(dashboard.todayMeals);
    expect(view.recommendedRecipes).toEqual(recommendedRecipes.slice(0, 3));
    expect(view.hasRealRecommendedRecipes).toBe(true);
    expect(view.expiringItems).toBe(dashboard.expiringItems);
    expect(view.firstName).toBe("An");
    expect(view.calorieTarget).toBe(2000);
    expect(view.consumedCalories).toBe(2100);
    expect(view.calorieProgress).toBe(100);
    expect(view.completedMeals).toBe(2);
    expect(view.mealProgress).toBe(67);
  });

  it("keeps Insight limited to two items, joins titles and clamps expired days to zero", () => {
    const view = buildDashboardViewModel(dashboard, "An", new Date("2026-09-15T00:00:00.000Z"));
    expect(view.insightItems).toEqual(dashboard.expiringItems.slice(0, 2));
    expect(view.insightTitle).toBe("Ức gà (2 ngày) và Rau (0 ngày)");
  });

  it("keeps all current fallback values when API data is absent", () => {
    const view = buildDashboardViewModel(undefined, undefined, new Date(2026, 8, 15, 9));
    expect(view).toMatchObject({
      todayMeals: [],
      recommendedRecipes: dashboardFallbackRecipes,
      hasRealRecommendedRecipes: false,
      expiringItems: [],
      greeting: "Chào buổi sáng",
      firstName: "bạn",
      calorieTarget: 2000,
      consumedCalories: 0,
      calorieProgress: 0,
      completedMeals: 0,
      mealProgress: 0,
      insightItems: [],
      insightTitle: "Kho thực phẩm của bạn đang được cân bằng tốt",
    });
  });

  it("uses fallback recipes for an empty API list but limits real recipes to three", () => {
    expect(buildDashboardViewModel({ ...dashboard, recommendedRecipes: [] }, "An").recommendedRecipes)
      .toBe(dashboardFallbackRecipes);
    expect(buildDashboardViewModel(dashboard, "An").recommendedRecipes).toHaveLength(3);
  });

  it("marks fallback recipes so they are not linked to a recipe detail page", () => {
    expect(buildDashboardViewModel({ ...dashboard, recommendedRecipes: [] }, "An").hasRealRecommendedRecipes).toBe(false);
    expect(buildDashboardViewModel(dashboard, "An").hasRealRecommendedRecipes).toBe(true);
  });

  it.each([
    [10, "Chào buổi sáng"],
    [11, "Chào buổi chiều"],
    [17, "Chào buổi chiều"],
    [18, "Chào buổi tối"],
  ])("keeps the greeting boundary at hour %i", (hour, greeting) => {
    expect(buildDashboardViewModel(undefined, "An", new Date(2026, 8, 15, hour)).greeting).toBe(greeting);
  });

  it("keeps zero-safe nutrition calculations", () => {
    const data: DashboardData = {
      ...dashboard,
      nutritionTargets: { ...dashboard.nutritionTargets!, calories: 0 },
      todayMeals: [{ ...dashboard.todayMeals[0], calories: 1 }],
    };
    const view = buildDashboardViewModel(data, "An");
    expect(view.calorieTarget).toBe(0);
    expect(view.consumedCalories).toBe(1);
    expect(view.calorieProgress).toBe(100);
    expect(view.mealProgress).toBe(100);
  });
});

describe("Dashboard hardcoded presentation rules", () => {
  it("keeps the current Recipes search path and blank-search behavior", () => {
    expect(dashboardRecipeSearchPath("  ức gà  ")).toBe("/recipes?q=%E1%BB%A9c%20g%C3%A0");
    expect(dashboardRecipeSearchPath("   ")).toBeNull();
  });

  it("keeps all local meal image rules", () => {
    expect(dashboardMealImage("Yến mạch chuối")).toBe("/assets/recipe-oats.jpg");
    expect(dashboardMealImage("Cá ngừ")).toBe("/assets/recipe-salmon.jpg");
    expect(dashboardMealImage("Bowl rau nấm")).toBe("/assets/recipe-vegan-bowl.jpg");
    expect(dashboardMealImage("Ức gà")).toBe("/assets/nutrition-hero.jpg");
  });

  it("keeps meal icon, label and time mappings", () => {
    expect(dashboardMealIcon("BREAKFAST")).toBe(Sunrise);
    expect(dashboardMealIcon("DINNER")).toBe(Moon);
    expect(dashboardMealIcon("LUNCH")).toBe(Sun);
    expect(dashboardMealIcon("SNACK")).toBe(Sun);
    expect(dashboardMealLabels).toEqual({ BREAKFAST: "Sáng", LUNCH: "Trưa", DINNER: "Tối", SNACK: "Bữa phụ" });
    expect(dashboardMealTimes).toEqual({ BREAKFAST: "08:00", LUNCH: "12:30", DINNER: "19:00", SNACK: "15:30" });
  });

  it("keeps the exact fallback recommendation data and fixed local images", () => {
    expect(dashboardFallbackRecipes).toHaveLength(3);
    expect(dashboardFallbackRecipes.map((recipe) => recipe.id)).toEqual([
      "fallback-quinoa", "fallback-penne", "fallback-salad",
    ]);
    expect(dashboardSuggestionImages).toEqual([
      "/assets/dashboard-recipe-chicken-quinoa-v4.jpg",
      "/assets/dashboard-recipe-chicken-pesto-v4.jpg",
      "/assets/dashboard-recipe-chicken-salad-v4.jpg",
    ]);
  });

  it("keeps the local water conversion", () => {
    expect(dashboardWaterLiters(0)).toBe(0);
    expect(dashboardWaterLiters(5)).toBe(1.25);
    expect(dashboardWaterLiters(8)).toBe(2);
  });
});
