import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recipeSearchView, recipeTotalText } from "./recipes.logic";
import { searchRecipes } from "./recipe-search";
import type { Recipe } from "../../types";

// Một hàm tìm cho mọi ô tìm món: bản frontend phải giống hệt bản gốc ở backend (test chi tiết ở backend recipe-search.test.ts).
describe("recipe-search dùng chung với backend", () => {
  it("giống hệt backend/src/services/recipe-search.ts", () => {
    const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
    expect(read("./recipe-search.ts")).toBe(read("../../../../backend/src/services/recipe-search.ts"));
  });
});

const recipe = (id: string, name: string, ingredients: string[], fit?: Recipe["fit"]) => ({
  id, name, cuisine: "Việt Nam", description: "", dietTags: [], mealTypes: ["LUNCH"], ingredients: ingredients.map((item) => ({ name: item })), fit,
}) as unknown as Recipe;
const allergic = { allergens: ["Đậu phộng"], dislikes: [], dietConflict: null, safe: false } as unknown as Recipe["fit"];
const data = [
  recipe("a", "Cơm trộn rau củ", ["Gạo", "Cà rốt"]),
  recipe("b", "Gỏi gà đậu phộng", ["Ức gà", "Đậu phộng"], allergic),
  recipe("c", "Canh đậu hũ", ["Đậu hũ", "Cà chua"]),
];

describe("Trang Công thức: tìm, số đếm, món bị ẩn theo hồ sơ", () => {
  it("không dấu, đảo thứ tự, theo nguyên liệu", () => {
    expect(searchRecipes(data, "com tron").map((item) => item.id)).toEqual(["a"]);
    expect(searchRecipes(data, "rau tron com").map((item) => item.id)).toEqual(["a"]);
    expect(searchRecipes(data, "đậu hũ").map((item) => item.id)).toEqual(["c"]);
  });

  it("món khớp nhưng bị ẩn do dị ứng được đếm riêng; Hiện tất cả thì không còn ẩn", () => {
    const view = recipeSearchView(data, "ga dau phong", false);
    expect(view.profileView.recipes.map((item) => item.id)).toEqual(["a", "c"]);
    expect(view.hiddenMatches).toBe(1);
    expect(view.counts.all).toBe(0);
    expect(recipeSearchView(data, "ga dau phong", true)).toMatchObject({ hiddenMatches: 0, counts: { all: 1 } });
  });

  it("số trên ô lọc theo kết quả tìm; dòng đầu trang khớp số đang hiện", () => {
    expect(recipeSearchView(data, "", false).counts.all).toBe(2);
    expect(recipeSearchView(data, "canh", false).counts.all).toBe(1);
    expect(recipeTotalText(33, 3, false)).toBe("30 món hợp với bạn (3 món ẩn theo hồ sơ)");
    expect(recipeTotalText(33, 3, true)).toBe("33 công thức");
    expect(recipeTotalText(33, 0, false)).toBe("33 công thức");
  });
});
