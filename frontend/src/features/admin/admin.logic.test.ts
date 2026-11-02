import { describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAdminRecipe, deleteAdminRecipe, listAdminRecipes, setAdminRecipeVisibility, uploadAdminRecipeImage, type AdminRecipeDetail } from "./admin.api";
import {
  deleteBlockedReason, emptyIngredient, emptyRecipeForm, hasRecipeErrors, moveRow, recipeImageError, toRecipeForm, toRecipeInput, usageText,
  validateRecipeForm, violationsByRow, type RecipeFormValues,
} from "./admin-recipes.logic";
import { hasWeeklyActivity, statsCards, weekLabel } from "./admin-stats.logic";

const detail: AdminRecipeDetail = {
  id: "recipe-a", slug: "dau-hu-sot", name: "Đậu hũ sốt", description: "Món chay", instructions: ["Chiên đậu", "Rưới sốt"],
  prepMinutes: 10, cookMinutes: 15, servings: 2, calories: 320, proteinG: 18, carbsG: 20, fatG: 12, fiberG: 3, cuisine: "Việt Nam",
  dietTags: ["VEGETARIAN", "VEGAN"], mealTypes: ["LUNCH"], imageUrl: null, hidden: false, usage: { mealPlanItems: 0, posts: 0 },
  ingredients: [{ id: "i1", name: "Đậu hũ", quantity: 200, unit: "G", optional: false }],
};
const validForm = (): RecipeFormValues => toRecipeForm(detail);

describe("Admin recipe form", () => {
  it("round-trips a recipe to the API payload without row keys", () => {
    const input = toRecipeInput(validForm());
    expect(input).toEqual({
      name: "Đậu hũ sốt", description: "Món chay", cuisine: "Việt Nam", instructions: ["Chiên đậu", "Rưới sốt"], prepMinutes: 10,
      cookMinutes: 15, servings: 2, calories: 320, proteinG: 18, carbsG: 20, fatG: 12, fiberG: 3, dietTags: ["VEGETARIAN", "VEGAN"],
      mealTypes: ["LUNCH"], imageUrl: null, ingredients: [{ name: "Đậu hũ", quantity: 200, unit: "G", optional: false }],
    });
    expect(hasRecipeErrors(validateRecipeForm(validForm()))).toBe(false);
  });

  it("mirrors the backend Zod limits, per field and per row", () => {
    const form = emptyRecipeForm();
    const butter = { ...emptyIngredient(), name: " Bơ ", quantity: "0" };
    const errors = validateRecipeForm({ ...form, name: "A", servings: "13", prepMinutes: "1.5", calories: "", dietTags: [], ingredients: [butter], steps: [{ key: "s", text: " " }] });
    expect(errors.fields).toMatchObject({
      name: "Nhập tên món ít nhất 2 ký tự.",
      description: "Nhập mô tả.",
      servings: "Nhập số nguyên từ 1 đến 12.",
      prepMinutes: "Nhập số nguyên từ 0 đến 600.",
      calories: "Nhập số nguyên từ 0 đến 5.000.",
      dietTags: "Chọn ít nhất một nhãn chế độ ăn.",
      mealTypes: "Chọn ít nhất một bữa.",
    });
    expect(errors.ingredients[butter.key]).toEqual({ name: "Ghi rõ \"Quả bơ\" hoặc \"Bơ lạt\".", quantity: "Nhập số lượng lớn hơn 0, tối đa 100.000." });
    expect(errors.steps.s).toBe("Nhập bước 1.");
    expect(validateRecipeForm({ ...validForm(), ingredients: [] }).fields.ingredients).toBe("Thêm ít nhất một nguyên liệu.");
  });

  it("puts the backend 422 diet violation on the offending ingredient row", () => {
    const form = validForm();
    const egg = { ...emptyIngredient(), name: "Trứng gà", quantity: "2", unit: "ITEM" as const };
    const rows = [...form.ingredients, egg];
    expect(violationsByRow([{ ingredient: "Trứng gà", terms: ["trứng"], dietTag: "VEGAN" }], rows)).toEqual({
      [egg.key]: "Có \"trứng\" nên không hợp với nhãn Thuần chay. Bỏ nguyên liệu này hoặc bỏ nhãn Thuần chay.",
    });
  });

  it("moves rows up and down within bounds", () => {
    expect(moveRow(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveRow(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("explains why a used recipe cannot be deleted and suggests hiding", () => {
    expect(usageText({ mealPlanItems: 0, posts: 0 })).toBe("Chưa dùng");
    expect(deleteBlockedReason({ mealPlanItems: 0, posts: 0 })).toBeNull();
    expect(deleteBlockedReason({ mealPlanItems: 3, posts: 1 })).toBe(
      "Món đang có trong 3 bữa trong thực đơn, 1 bài viết nên không xóa được. Hãy ẩn món: người dùng không thấy nữa, dữ liệu cũ vẫn giữ.",
    );
  });

  it("checks recipe images before upload", () => {
    expect(recipeImageError({ name: "a.jpg", type: "image/jpeg", size: 1024 })).toBeNull();
    expect(recipeImageError({ name: "a.gif", type: "image/gif", size: 1024 })).toBe("\"a.gif\" không phải ảnh JPG, PNG hoặc WEBP.");
    expect(recipeImageError({ name: "b.png", type: "image/png", size: 6 * 1024 * 1024 })).toBe("\"b.png\" vượt quá 5 MB. Chọn ảnh nhỏ hơn.");
  });
});

describe("Admin stats", () => {
  it("captions the totals with real numbers", () => {
    const cards = statsCards({ users: 12, lockedUsers: 1, mealPlans: 30, posts: 4, recipes: 33, hiddenRecipes: 0 });
    expect(cards.map((card) => [card.value, card.note])).toEqual([
      ["12", "Trong đó 1 bị khóa"], ["30", "Mọi trạng thái: nháp, đang áp dụng, đã xong"], ["4", "Trong cộng đồng"], ["33", "Tất cả đang hiện"],
    ]);
  });
  it("labels weeks dd/MM and detects empty series", () => {
    expect(weekLabel("2026-11-02")).toBe("02/11");
    expect(hasWeeklyActivity([{ weekStart: "2026-11-02", users: 0, mealPlans: 0, posts: 0 }])).toBe(false);
  });
});

describe("Admin API adapters (no network)", () => {
  it("uses the existing admin endpoints", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: {}, status: 200, statusText: "OK", headers: {} }));
    const original = api.defaults.adapter;
    api.defaults.adapter = adapter;
    await listAdminRecipes({ search: "  ", status: "hidden", page: 2, pageSize: 20 });
    await createAdminRecipe(toRecipeInput(validForm()));
    await setAdminRecipeVisibility({ id: "recipe-a", hidden: true });
    await uploadAdminRecipeImage({ id: "recipe-a", file: new File(["x"], "a.jpg", { type: "image/jpeg" }) });
    await deleteAdminRecipe("recipe-a");
    api.defaults.adapter = original;
    const calls = adapter.mock.calls.map(([config]) => [config.method, config.url]);
    expect(calls).toEqual([
      ["get", "/admin/recipes"], ["post", "/admin/recipes"], ["patch", "/admin/recipes/recipe-a/visibility"],
      ["put", "/admin/recipes/recipe-a/image"], ["delete", "/admin/recipes/recipe-a"],
    ]);
    expect(adapter.mock.calls[0][0].params).toEqual({ search: undefined, status: "hidden", page: 2, pageSize: 20 });
    expect(adapter.mock.calls[3][0].data).toBeInstanceOf(FormData);
  });
});
