import { describe, expect, it } from "vitest";
import { foodNameOption, pantrySearchOptions } from "../pantry/pantry.logic";
import { recipeSuggestionOptions } from "../recipes/recipes.logic";
import type { Recipe } from "../../types";
import { rankOptions } from "./combobox.logic";

const recipe = (id: string, name: string, ingredients: string[], allergens: string[] = []) => ({
  id, name, cuisine: "Hàn Quốc", ingredients: ingredients.map((item) => ({ name: item })),
  fit: { allergens, dislikedFoods: [], dietConflict: null, safe: !allergens.length },
}) as unknown as Recipe;

describe("Gợi ý cho từng ô", () => {
  const recipes = [recipe("a", "Cơm trộn Hàn Quốc", ["Gạo", "Trứng"], ["Trứng (Trứng)"]), recipe("b", "Canh kim chi", ["Kim chi", "Đậu hũ"])];

  it("Công thức: tên món (món bị ẩn theo hồ sơ ghi nhãn), nguyên liệu, ẩm thực; tìm món theo nguyên liệu", () => {
    const options = recipeSuggestionOptions(recipes, false);
    expect(rankOptions(options, "com tron")[0]).toMatchObject({ label: "Cơm trộn Hàn Quốc", detail: "ẩn theo hồ sơ" });
    expect(recipeSuggestionOptions(recipes, true)[0].detail).toBe("Món");
    expect(rankOptions(options, "dau hu").map((option) => [option.label, option.detail])).toEqual([["Đậu hũ", "Nguyên liệu"], ["Canh kim chi", "Món"]]);
    expect(rankOptions(options, "han quoc").map((option) => option.detail)).toEqual(["Ẩm thực", "ẩn theo hồ sơ", "Món"]);
  });

  it("Kho: tên thực phẩm kèm nhóm, và các nhóm", () => {
    const options = pantrySearchOptions([{ id: "1", name: "Ức gà", category: "Thịt & cá" }, { id: "2", name: "Cà rốt", category: "Rau củ" }]);
    expect(rankOptions(options, "uc")[0]).toMatchObject({ label: "Ức gà", detail: "Thịt & cá" });
    expect(rankOptions(options, "rau")[0]).toMatchObject({ label: "Rau củ", detail: "Nhóm" });
  });

  it("Tên khi thêm thực phẩm: ghi nhóm dị ứng nếu có, nếu không thì nguồn của tên", () => {
    expect(foodNameOption({ name: "Trứng", source: "RECIPE", allergyGroups: ["Trứng"] }).detail).toBe("nhóm Trứng");
    expect(foodNameOption({ name: "Ức gà", source: "PANTRY", allergyGroups: [] }).detail).toBe("Đã có trong kho");
    expect(foodNameOption({ name: "Gạo", source: "RECIPE", allergyGroups: [] }).detail).toBe("Nguyên liệu món");
  });
});
