import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { SEED_FOOD_CATEGORIES } from "../../test/seed-catalog";
import { createAppQueryClient, retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { MealPlan, MealPlanItem, NutritionProfile, Recipe } from "../../types";
import {
  addMealPlanItem, deleteMealPlan, deleteMealPlanItem, generateMealPlan, getMealPlan, listMealPlans, updateMealCompletion,
  swapMealItem, updateMealPlanStatus, updateShoppingPurchased,
} from "./meal-plans.api";
import { addablePlans, addableRecipes, defaultMealType, mealTypeOptions, planDayOptions, portionOptions } from "./add-meal.logic";
import {
  alternativeMeals, dayNutrition, generateMealPlanLabel, groupShoppingItems, aiJobMessage, aiJobProgress, aiJobElapsedSeconds, initialDayIndex, latestMealPlanId,
  mealPlanDeleteConfirm, mealPlanPath, mealViolation, mealPlanSourceLabel, nextMealPlanIdAfterDelete, orderDayMeals, planDayLabels,
  planTargets, planTitleParts, selectMealPlanDay, summarizeMealPlan, todayDayIndex,
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

  it("adds and deletes a meal item with the plan ownership in the URL", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: plan, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await addMealPlanItem({ planId: plan.id, dayId: "day-a", mealType: "LUNCH", recipeId: "recipe-a", servings: 1.5 });
    await deleteMealPlanItem("meal-a");
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ["post", `/meal-plans/${plan.id}/items`], ["delete", "/meal-plans/items/meal-a"],
    ]);
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ dayId: "day-a", mealType: "LUNCH", recipeId: "recipe-a", servings: 1.5 });
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
        add: () => addMealPlanItem({ planId: plan.id, dayId: "day-a", mealType: "LUNCH", recipeId: "recipe-a", servings: 1 }),
        removeItem: () => deleteMealPlanItem("meal-a"),
      };
      await expect(actions[operation]()).rejects.toBe(failure);
    },
  );
});

describe("Manual meal selection", () => {
  it("filters unsafe recipes, wrong meal types and searches by name or ingredient", () => {
    const recipes = [
      recipe({ id: "safe", name: "Đậu hũ rau", mealTypes: ["LUNCH"], fit: { safe: true, allergens: [], dislikedFoods: [], dietConflict: null } }),
      recipe({ id: "unsafe", name: "Tôm rang", mealTypes: ["LUNCH"], fit: { safe: false, allergens: ["tôm"], dislikedFoods: [], dietConflict: null } }),
      recipe({ id: "breakfast", name: "Cháo sáng", mealTypes: ["BREAKFAST"], fit: { safe: true, allergens: [], dislikedFoods: [], dietConflict: null }, ingredients: [{ id: "i", name: "gạo", quantity: 1, unit: "G", optional: false }] }),
    ];
    expect(addableRecipes(recipes, "LUNCH", "rau").map((item) => item.id)).toEqual(["safe"]);
    expect(addableRecipes(recipes, "BREAKFAST", "").map((item) => item.id)).toEqual(["breakfast"]);
  });

  it("offers half-serving steps up to four portions", () => {
    expect(portionOptions).toEqual([0.5, 1, 1.5, 2, 3, 4]);
  });

  it("can add to an empty day and to the snack slot: defaults to the first free meal, snack when the day is full", () => {
    expect(mealTypeOptions.map((option) => option.value)).toEqual(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
    expect(defaultMealType([])).toBe("BREAKFAST");
    expect(defaultMealType([{ mealType: "BREAKFAST" }])).toBe("LUNCH");
    expect(defaultMealType([{ mealType: "BREAKFAST" }, { mealType: "LUNCH" }, { mealType: "DINNER" }])).toBe("SNACK");
    expect(defaultMealType(["BREAKFAST", "LUNCH", "SNACK", "DINNER"].map((mealType) => ({ mealType: mealType as MealPlanItem["mealType"] })))).toBe("SNACK");
  });

  it("from a recipe page: only plans not completed, the active one first, with weekday day labels", () => {
    const plans = [
      { ...plan, id: "old", status: "COMPLETED" as const },
      { ...plan, id: "draft", status: "DRAFT" as const, startDate: "2026-11-20T00:00:00.000Z" },
      { ...plan, id: "active", status: "ACTIVE" as const, startDate: "2026-11-01T00:00:00.000Z" },
    ];
    expect(addablePlans(plans).map((item) => item.id)).toEqual(["active", "draft"]);
    expect(planDayOptions({ days: [{ id: "d1", date: "2026-11-09T00:00:00.000Z", items: [] }] })).toEqual([{ value: "d1", label: "Thứ Hai, 09/11" }]);
    expect(planDayOptions(undefined)).toEqual([]);
  });
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
  it("falls back to the first day when the requested day does not exist", () => {
    expect(selectMealPlanDay(plan, 20)).toBe(plan.days[0]);
  });

  it("calculates week totals, daily averages and Shopping count", () => {
    expect(summarizeMealPlan(plan)).toMatchObject({
      completedMeals: 1,
      purchasedItems: 1,
      nutrition: { calories: 1100, protein: 80, carbs: 110, fat: 28, fiber: 14 },
      averages: { calories: 550, protein: 40, carbs: 55, fat: 14, fiber: 7 },
    });
  });

  it("uses profile targets only, never made-up defaults", () => {
    const profile = { dailyCalorieTarget: 1800, proteinTargetG: 90, carbTargetG: 200, fatTargetG: 60 } as NutritionProfile;
    expect(planTargets(profile)).toEqual({ calories: 1800, protein: 90, carbs: 200, fat: 60 });
    expect(planTargets(null)).toBeNull();
    expect(planTargets({ dietType: "BALANCED" } as NutritionProfile)).toBeNull();
  });

  it("sums the day's meals (macros × servings) against the targets", () => {
    const items = [meal({ servings: 2, calories: 800 }), meal({ id: "meal-x", mealType: "DINNER", completed: false, calories: 500 })];
    const result = dayNutrition(items, { calories: 2000, protein: 100, carbs: 200, fat: 50 });
    expect(result.calories).toEqual({ consumed: 1300, target: 2000, percent: 65 });
    expect(result.macros.protein).toEqual({ consumed: 90, target: 100, percent: 90 });
    expect(result).toMatchObject({ eatenCount: 1, eatenCalories: 800, mealCount: 2 });
  });

  it("orders the day's meals breakfast, lunch, snack, dinner", () => {
    const types = ["DINNER", "SNACK", "BREAKFAST", "LUNCH"] as const;
    const items = types.map((mealType, index) => meal({ id: `m${index}`, mealType }));
    expect(orderDayMeals(items).map((item) => item.mealType)).toEqual(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
  });

  it("opens today when the plan covers it, otherwise the first day", () => {
    expect(todayDayIndex(plan, new Date(2026, 9, 2, 23, 30))).toBe(1);
    expect(initialDayIndex(plan, new Date(2026, 9, 2, 0, 5))).toBe(1);
    expect(todayDayIndex(plan, new Date(2026, 9, 9))).toBe(-1);
    expect(initialDayIndex(plan, new Date(2026, 9, 9))).toBe(0);
    expect(planDayLabels(plan.days[0])).toEqual({ weekday: "Thứ Năm", short: "T5", date: "01/10" });
  });

  it("splits the backend plan name to emphasise its date", () => {
    expect(planTitleParts("Thực đơn 2/11/2026")).toEqual({ lead: "Thực đơn", emphasis: "2/11/2026" });
    expect(planTitleParts("Tuần ăn chay")).toEqual({ lead: "Tuần ăn chay", emphasis: "" });
  });

  it("keeps the first two alternative meals with their day and excludes the primary item", () => {
    expect(alternativeMeals(plan, "BREAKFAST", "meal-a").map(({ item, day }) => [item.id, day.id])).toEqual([["meal-b", "day-b"]]);
  });

  it("groups shopping items by the backend category in the 8 shared groups' order, unpurchased first", () => {
    const result = groupShoppingItems([
      { name: "Muối", purchased: false, category: "Gia vị" }, { name: "Tỏi", purchased: true, category: "Rau củ" },
      { name: "Hành lá", purchased: false, category: "Rau củ" }, { name: "Tôm", purchased: false, category: "Thịt & cá" },
      { name: "Đậu hũ", purchased: false, category: "Đậu & hạt" }, { name: "Gạo", purchased: false, category: "Ngũ cốc" },
      { name: "Đá viên", purchased: false, category: null },
    ], SEED_FOOD_CATEGORIES);
    expect(result.map((group) => [group.name, group.items.map((item) => item.name)])).toEqual([
      ["Rau củ", ["Hành lá", "Tỏi"]], ["Thịt & cá", ["Tôm"]], ["Đậu & hạt", ["Đậu hũ"]], ["Ngũ cốc", ["Gạo"]], ["Gia vị", ["Muối"]], ["Khác", ["Đá viên"]],
    ]);
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
  it("names the plan in the delete confirmation, warns when it is active and states the consequence", () => {
    const draft = mealPlanDeleteConfirm({ name: "Tuần 1", status: "DRAFT" });
    expect(draft.title).toBe("Xóa “Tuần 1”?");
    expect(draft.description).not.toContain("đang được áp dụng");
    expect(draft.description).toContain("Không hoàn tác được.");
    expect(draft.confirmLabel).toBe("Xóa thực đơn");
    expect(mealPlanDeleteConfirm({ name: "Tuần 2", status: "ACTIVE" }).description).toContain("Thực đơn này đang được áp dụng.");
  });
  it("does not retry plan details for client errors such as 404", () => {
    expect(mealPlanQueries.detail("plan-a").retry).toBe(retryUnlessClientError);
  });
});

describe("Old plan meals that violate the current profile (GĐ3b-R2)", () => {
  const fit = { allergens: ["tôm"], dislikedFoods: [], dietConflict: null, safe: false };

  it("warns about an unsafe meal and offers a swap only while it is not eaten", () => {
    expect(mealViolation(meal({ completed: false, recipe: recipe({ fit }) }))).toEqual({ warnings: fit, canSwap: true });
    expect(mealViolation(meal({ completed: true, recipe: recipe({ fit }) }))).toEqual({ warnings: fit, canSwap: false });
  });

  it("shows nothing for a safe meal or when the API sends no fit", () => {
    expect(mealViolation(meal({ recipe: recipe({ fit: { ...fit, allergens: [], safe: true } }) }))).toBeNull();
    expect(mealViolation(meal())).toBeNull();
  });

  it("posts the swap without choosing the recipe on the client", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { plan, from: "Tôm rang", to: "Đậu hũ" }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await swapMealItem("meal-a")).toEqual({ plan, from: "Tôm rang", to: "Đậu hũ" });
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url, config.data])).toEqual([["post", "/meal-plans/items/meal-a/swap", "{}"]]);
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
  it("Tạo bằng AI chạy nền: thời gian đã chạy, tiến trình ước tính, kết quả và lý do dùng thuật toán", () => {
    const startedAt = "2026-11-12T10:00:00.000Z";
    const base = { id: "j", startDate: "2026-11-12", startedAt, finishedAt: null, planId: null, fallbackReason: null, error: null };
    const at = (seconds: number) => Date.parse(startedAt) + seconds * 1000;
    expect(aiJobMessage({ ...base, status: "RUNNING" }, at(75))).toBe(
      "Đang tạo thực đơn bằng AI (đã chạy 1:15, thường 1–2 phút). Bạn có thể rời trang, Nouri sẽ gửi thông báo khi xong.",
    );
    expect(aiJobElapsedSeconds(base, at(-5))).toBe(0);
    expect(aiJobProgress(base, at(60))).toBe(50);
    expect(aiJobProgress(base, at(500))).toBe(95);
    expect(aiJobMessage({ ...base, status: "DONE", planId: "p" }, at(80))).toBe("Thực đơn AI đã sẵn sàng.");
    expect(aiJobMessage({ ...base, status: "DONE", planId: "p", fallbackReason: "AI_TIMEOUT" }, at(130)))
      .toBe("Không dùng được AI (AI quá 2 phút chưa trả lời) nên Nouri đã tạo thực đơn bằng thuật toán.");
    expect(aiJobMessage({ ...base, status: "FAILED", error: "Chưa tạo được thực đơn. Hãy thử lại." }, at(10))).toBe("Chưa tạo được thực đơn. Hãy thử lại.");
  });
  it("keeps one action name for the generate button", () => {
    expect(generateMealPlanLabel(false)).toBe("Tạo thực đơn");
    expect(generateMealPlanLabel(true)).toBe("Đang tạo thực đơn...");
  });
});
