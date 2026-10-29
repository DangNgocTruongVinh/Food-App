import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient, retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { MealPlan, MealPlanItem, NutritionProfile, Recipe } from "../../types";
import {
  deleteMealPlan, generateMealPlan, getMealPlan, listMealPlans, updateMealCompletion,
  updateMealPlanStatus, updateShoppingPurchased,
} from "./meal-plans.api";
import {
  alternativeMeals, hasBalancedCalories, mealItemImage, mealPlanDeleteConfirmMessage, mealPlanPath, mealPlanTargets,
  generateMealPlanLabel, latestMealPlanId, mealPlanSourceLabel, mealPlanSuggestions, mealTag, nextMealPlanIdAfterDelete, percentage, recipeSearchPath, selectMealPlan, selectMealPlanDay,
  summarizeMealPlan,
} from "./meal-plans.logic";
import { invalidateMealPlanQueries, mealPlanQueries, removeDeletedMealPlan, removeMealPlanDetail } from "./meal-plans.queries";

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: "recipe-a", name: "Ức gà", description: "Món cân bằng", instructions: ["Áp chảo"],
  prepMinutes: 10, cookMinutes: 20, servings: 1, calories: 400, proteinG: 30,
  carbsG: 40, fatG: 10, fiberG: 5, cuisine: "Việt Nam", dietTags: ["BALANCED"], ingredients: [],
  ...overrides,
});
const meal = (overrides: Partial<MealPlanItem> = {}): MealPlanItem => ({
  id: "meal-a", mealType: "BREAKFAST", servings: 1, calories: 400, completed: true,
  recipe: recipe(), ...overrides,
});
const plan: MealPlan = {
  id: "plan-a", name: "Thực đơn tuần", startDate: "2026-10-01T00:00:00.000Z",
  endDate: "2026-10-07T00:00:00.000Z", status: "DRAFT", calorieTarget: 2000,
  aiGenerated: false, summary: "Thực đơn mẫu",
  days: [
    { id: "day-a", date: "2026-10-01T00:00:00.000Z", items: [meal()] },
    { id: "day-b", date: "2026-10-02T00:00:00.000Z", items: [
      meal({
        id: "meal-b", completed: false, calories: 300,
        recipe: recipe({ id: "recipe-b", proteinG: 20, carbsG: 30, fatG: 8, fiberG: 4, dietTags: [] }),
      }),
      meal({ id: "meal-c", mealType: "LUNCH", completed: false }),
    ] },
  ],
  shoppingItems: [
    { id: "shop-a", name: "Ức gà", quantity: 500, unit: "G", purchased: true },
    { id: "shop-b", name: "Bông cải", quantity: 300, unit: "G", purchased: false },
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

describe("Meal Plan and Shopping API adapters (no network)", () => {
  it("uses the existing list and detail endpoints", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: config.url === "/meal-plans" ? [plan] : plan,
      status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    expect(await listMealPlans()).toEqual([plan]);
    expect(await getMealPlan(plan.id)).toEqual(plan);
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ["get", "/meal-plans"], ["get", `/meal-plans/${plan.id}`],
    ]);
  });

  it("generates a plan with the unchanged startDate payload", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: plan, status: 201, statusText: "Created", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await generateMealPlan("2026-10-01")).toEqual(plan);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: "/meal-plans/generate" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ startDate: "2026-10-01" });
  });

  it("updates plan status with the existing PATCH contract", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: plan, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await updateMealPlanStatus({ id: plan.id, status: "ACTIVE" });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "patch", url: `/meal-plans/${plan.id}/status` });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ status: "ACTIVE" });
  });

  it("updates meal completion with the existing PATCH contract", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: plan.days[0].items[0], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await updateMealCompletion({ id: "meal-a", completed: false });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "patch", url: "/meal-plans/items/meal-a" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ completed: false });
  });

  it("updates Shopping purchase state with the existing PATCH contract", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: plan.shoppingItems[0], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await updateShoppingPurchased({ id: "shop-a", purchased: false });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "patch", url: "/meal-plans/shopping/shop-a" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ purchased: false });
  });

  it("deletes a plan through the existing endpoint", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: undefined, status: 204, statusText: "No Content", headers: {} }));
    api.defaults.adapter = adapter;
    await expect(deleteMealPlan(plan.id)).resolves.toBeUndefined();
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "delete", url: `/meal-plans/${plan.id}` });
  });

  it.each(["list", "detail", "generate", "status", "meal", "shopping", "delete"] as const)(
    "propagates a failed %s request",
    async (operation) => {
      const failure = new Error(`${operation} failed`);
      api.defaults.adapter = async () => { throw failure; };
      const actions = {
        list: () => listMealPlans(),
        detail: () => getMealPlan(plan.id),
        generate: () => generateMealPlan("2026-10-01"),
        status: () => updateMealPlanStatus({ id: plan.id, status: "ACTIVE" }),
        meal: () => updateMealCompletion({ id: "meal-a", completed: true }),
        shopping: () => updateShoppingPurchased({ id: "shop-a", purchased: true }),
        delete: () => deleteMealPlan(plan.id),
      };
      await expect(actions[operation]()).rejects.toBe(failure);
    },
  );
});

describe("Meal Plan query definitions", () => {
  it("uses shared list and detail keys and caches list responses", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: [plan], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(mealPlanQueries.list().queryKey).toEqual(["meal-plans", "list"]);
    expect(mealPlanQueries.detail(plan.id).queryKey).toEqual(["meal-plans", "detail", plan.id]);
    expect(await client.fetchQuery(mealPlanQueries.list())).toEqual([plan]);
    expect(await client.fetchQuery(mealPlanQueries.list())).toEqual([plan]);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("invalidates Meal Plan only for Shopping and includes Dashboard for plan/meal changes", () => {
    for (const key of [["meal-plans"], ["meal-plans", "list"], ["meal-plans", "detail", plan.id], ["dashboard"], ["profile"]]) {
      client.setQueryData(key, {});
    }
    invalidateMealPlanQueries(client, false);
    expect(client.getQueryState(queryKeys.mealPlans.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.mealPlans.detail(plan.id))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.dashboard)?.isInvalidated).toBe(false);
    invalidateMealPlanQueries(client, true);
    expect(client.getQueryState(queryKeys.dashboard)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.profile)?.isInvalidated).toBe(false);
  });
});

describe("Meal Plan and Shopping page business logic", () => {
  it("selects the requested plan and falls back to the first plan/day", () => {
    const another = { ...plan, id: "plan-b" };
    expect(selectMealPlan([plan, another], "plan-b")).toBe(another);
    expect(selectMealPlan([plan, another], "missing")).toBe(plan);
    expect(selectMealPlanDay(plan, 20)).toBe(plan.days[0]);
  });

  it("calculates existing totals, daily averages, progress and Shopping count", () => {
    expect(summarizeMealPlan(plan)).toMatchObject({
      completedMeals: 1,
      purchasedItems: 1,
      nutrition: { calories: 1100, protein: 80, carbs: 110, fat: 28, fiber: 14 },
      averages: { calories: 550, protein: 40, carbs: 55, fat: 14, fiber: 7 },
      completionRate: 33,
    });
  });

  it("uses profile targets first and retains all existing fallback targets", () => {
    const profile = { dailyCalorieTarget: 1800, proteinTargetG: 90 } as NutritionProfile;
    expect(mealPlanTargets(profile, plan)).toEqual({ calories: 1800, protein: 90, carbs: 250, fat: 65, fiber: 30 });
    expect(mealPlanTargets(null, undefined)).toEqual({ calories: 2000, protein: 80, carbs: 250, fat: 65, fiber: 30 });
  });

  it("keeps the existing nutrition percentage and calorie balance rules", () => {
    expect(percentage(75, 100)).toBe(75);
    expect(percentage(150, 100)).toBe(100);
    expect(percentage(1, 0)).toBe(100);
    expect(hasBalancedCalories(1700, 2000)).toBe(true);
    expect(hasBalancedCalories(1699, 2000)).toBe(false);
  });

  it("keeps meal tag priority", () => {
    expect(mealTag(plan.days[0].items[0])).toBe("BALANCED");
    expect(mealTag(meal({ recipe: recipe({ dietTags: [], proteinG: 25 }) }))).toBe("Giàu protein");
    expect(mealTag(meal({ recipe: recipe({ dietTags: [], proteinG: 10, fatG: 15 }) }))).toBe("Ít chất béo");
  });

  it("shows each meal with its own recipe image, not an image chosen by meal type", () => {
    const veganDinner = meal({ mealType: "DINNER", recipe: recipe({ name: "Nấm kho tiêu", imageUrl: "/assets/recipe-vegan-bowl.jpg" }) });
    const fishDinner = meal({ mealType: "DINNER", recipe: recipe({ name: "Cá kho tộ", imageUrl: "/assets/recipe-salmon.jpg" }) });
    expect(mealItemImage(veganDinner)).toBe("/assets/recipe-vegan-bowl.jpg");
    expect(mealItemImage(fishDinner)).toBe("/assets/recipe-salmon.jpg");
    // Công thức chưa có imageUrl dùng ảnh tạm theo tên món.
    expect(mealItemImage(meal({ recipe: recipe({ name: "Yến mạch chuối", imageUrl: null }) }))).toBe("/assets/recipe-oats.jpg");
    expect(mealItemImage(meal({ recipe: recipe({ name: "Cháo gà", imageUrl: "https://cdn.example/chao.jpg" }) }))).toBe("https://cdn.example/chao.jpg");
  });

  it("keeps the first two alternative meals and excludes the primary item", () => {
    expect(alternativeMeals(plan, "BREAKFAST", "meal-a").map((item) => item.id)).toEqual(["meal-b"]);
  });

  it("keeps the existing Recipes search navigation", () => {
    expect(recipeSearchPath("  ức gà  ")).toBe("/recipes?q=%E1%BB%A9c%20g%C3%A0");
    expect(recipeSearchPath("   ")).toBe("/recipes");
  });
});

describe("Meal plan route and delete helpers", () => {
  it("builds the plan route, or the list route when there is no plan", () => {
    expect(mealPlanPath("plan-a")).toBe("/meal-plans/plan-a");
    expect(mealPlanPath(null)).toBe("/meal-plans");
    expect(mealPlanPath(undefined)).toBe("/meal-plans");
  });
  it("selects the newest remaining plan after deleting one", () => {
    const plans = [
      { id: "oldest", startDate: "2026-10-01T00:00:00.000Z" },
      { id: "newest", startDate: "2026-10-15T00:00:00.000Z" },
      { id: "middle", startDate: "2026-10-08T00:00:00.000Z" },
    ];
    expect(nextMealPlanIdAfterDelete(plans, "middle")).toBe("newest");
    expect(nextMealPlanIdAfterDelete(plans, "newest")).toBe("middle");
    expect(nextMealPlanIdAfterDelete([{ id: "only", startDate: "2026-10-01" }], "only")).toBeNull();
    expect(nextMealPlanIdAfterDelete([], "missing")).toBeNull();
  });
  it("opens the newest plan by start date, then by creation time when start dates match", () => {
    expect(latestMealPlanId([
      { id: "earlier-start", startDate: "2026-10-01T00:00:00.000Z", createdAt: "2026-10-20T10:00:00.000Z" },
      { id: "same-start-created-first", startDate: "2026-10-08T00:00:00.000Z", createdAt: "2026-10-01T09:00:00.000Z" },
      { id: "same-start-created-last", startDate: "2026-10-08T00:00:00.000Z", createdAt: "2026-10-01T11:00:00.000Z" },
    ])).toBe("same-start-created-last");
    expect(latestMealPlanId([])).toBeNull();
  });
  it("names the plan in the delete confirmation and warns when it is active", () => {
    const draft = mealPlanDeleteConfirmMessage({ name: "Tuần 1", status: "DRAFT" });
    expect(draft).toContain("“Tuần 1”");
    expect(draft).not.toContain("đang được áp dụng");
    expect(mealPlanDeleteConfirmMessage({ name: "Tuần 2", status: "ACTIVE" })).toContain("Thực đơn này đang được áp dụng.");
  });
  it("does not retry plan details for client errors such as 404", () => {
    expect(mealPlanQueries.detail("plan-a").retry).toBe(retryUnlessClientError);
  });
});

describe("Meal plan suggestions respect the profile", () => {
  const profile = (overrides: Partial<NutritionProfile> = {}): NutritionProfile => ({
    activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED", allergies: [], dislikedFoods: [],
    preferredCuisines: [], mealsPerDay: 3, ...overrides,
  });
  const fatSuggestion = (value: NutritionProfile | null | undefined) =>
    mealPlanSuggestions(value, { fiber: 30, fat: 40 }, { fiber: 30, fat: 60 })[1];

  it("suggests oily fish only when nothing in the profile rules it out", () => {
    expect(fatSuggestion(profile()).key).toBe("omega3-fish");
    expect(fatSuggestion(undefined).key).toBe("omega3-fish");
  });
  it.each([
    ["vegetarian", profile({ dietType: "VEGETARIAN" })],
    ["vegan", profile({ dietType: "VEGAN" })],
    ["seafood allergy", profile({ allergies: ["Hải sản"] })],
    ["fish allergy written differently", profile({ allergies: ["  CÁ  hồi "] })],
    ["disliked fish", profile({ dislikedFoods: ["cá"] })],
  ])("never suggests fish for %s", (_label, value) => {
    const suggestion = fatSuggestion(value);
    expect(suggestion.key).toBe("omega3-plant");
    expect(suggestion.text).not.toMatch(/\bcá\b|cá béo|cá hồi/i);
    expect(suggestion.image).not.toContain("salmon");
  });
  it("falls back to a neutral suggestion when plant sources are also restricted", () => {
    const suggestion = fatSuggestion(profile({ dietType: "VEGAN", allergies: ["Đậu nành"] }));
    expect(suggestion.key).toBe("fat-plant-oil");
    expect(suggestion.text).not.toMatch(/cá|đậu nành|óc chó/i);
  });
  it("does not mistake an unrelated allergy for fish", () => {
    expect(fatSuggestion(profile({ allergies: ["Cà chua", "Đậu phộng"] })).key).toBe("omega3-fish");
  });
  it("keeps the fiber suggestion and the reduce-fat advice free of fish", () => {
    const [fiber, fat] = mealPlanSuggestions(profile({ dietType: "VEGAN" }), { fiber: 10, fat: 80 }, { fiber: 30, fat: 60 });
    expect(fiber.text).toContain("rau xanh");
    expect(fat.key).toBe("fat-reduce");
    expect(fat.image).not.toContain("salmon");
  });
});

describe("Deleting a meal plan updates the cache before navigation", () => {
  it("drops the plan from the list and refreshes list and dashboard, but never refetches the deleted detail", () => {
    const queryClient = createAppQueryClient();
    const other = { ...plan, id: "plan-b" };
    queryClient.setQueryData(queryKeys.mealPlans.list(), [plan, other]);
    queryClient.setQueryData(queryKeys.mealPlans.detail(plan.id), plan);
    queryClient.setQueryData(queryKeys.dashboard, {});

    removeDeletedMealPlan(queryClient, plan.id);
    expect(queryClient.getQueryData<MealPlan[]>(queryKeys.mealPlans.list())?.map((item) => item.id)).toEqual(["plan-b"]);
    expect(queryClient.getQueryState(queryKeys.mealPlans.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.dashboard)?.isInvalidated).toBe(true);
    // Chi tiết của thực đơn đã xóa không bị đánh dấu làm mới (nếu không sẽ gọi lại API và nhận 404).
    expect(queryClient.getQueryState(queryKeys.mealPlans.detail(plan.id))?.isInvalidated).toBe(false);

    // Trang đã rời khỏi thực đơn: bỏ cache chi tiết.
    removeMealPlanDetail(queryClient, plan.id);
    expect(queryClient.getQueryData(queryKeys.mealPlans.detail(plan.id))).toBeUndefined();

    // Xóa nốt thực đơn cuối: danh sách rỗng nên /meal-plans không còn thực đơn nào để mở lại.
    removeDeletedMealPlan(queryClient, "plan-b");
    expect(queryClient.getQueryData<MealPlan[]>(queryKeys.mealPlans.list())).toEqual([]);
    expect(latestMealPlanId(queryClient.getQueryData<MealPlan[]>(queryKeys.mealPlans.list()) ?? [])).toBeNull();
    queryClient.clear();
  });
});

describe("Honest meal plan labels", () => {
  it("labels the plan by how it was actually generated", () => {
    expect(mealPlanSourceLabel(true)).toBe("Tạo bởi AI");
    expect(mealPlanSourceLabel(false)).toBe("Thuật toán gợi ý");
  });
  it.each([
    [true, false, "Tạo thực đơn AI"], [true, true, "AI đang tạo..."],
    [false, false, "Tạo thực đơn"], [false, true, "Đang tạo..."],
    [undefined, false, "Tạo thực đơn"], [undefined, true, "Đang tạo..."],
  ] as const)("mentions AI only when the backend reports it is configured (available=%s, pending=%s)", (available, pending, label) => {
    expect(generateMealPlanLabel(available, pending)).toBe(label);
  });
});
