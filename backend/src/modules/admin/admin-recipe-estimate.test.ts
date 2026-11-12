import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findPost: vi.fn(), listIngredients: vi.fn(), estimate: vi.fn() }));
vi.mock("../../config/env.js", () => ({ env: { OPENAI_MODEL: "gpt-5-mini" } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: { communityPost: { findUnique: mocks.findPost }, recipeIngredient: { findMany: mocks.listIngredients } },
}));
vi.mock("../ai/recipe-estimate.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../ai/recipe-estimate.js")>(), createRecipeEstimator: () => mocks.estimate,
}));
const { estimateRecipeFromPost } = await import("./admin-recipe-estimate.service.js");
const { createRecipeEstimator: realEstimator } = await vi.importActual<typeof import("../ai/recipe-estimate.js")>("../ai/recipe-estimate.js");

const memberRecipe = {
  name: "Canh chua tôm", servings: 2, minutes: 30,
  ingredients: [{ name: "tom su", quantity: "300", unit: "g" }, { name: "Me chua", quantity: "1", unit: "muỗng" }],
  steps: ["Nấu"],
};
const known = ["Tôm sú", "Cà chua", "Me"];

// Phản hồi giả lập của Responses API, không gọi OpenAI thật.
const fakeClient = (body: unknown) => ({ responses: { create: vi.fn(async () => ({ output_text: JSON.stringify(body) })) } }) as never;

describe("createRecipeEstimator", () => {
  it("ước tính một khẩu phần (làm tròn, kẹp trong giới hạn), tên chỉ nhận tên có trong thư viện hoặc giữ tên gốc", async () => {
    const estimate = realEstimator(fakeClient({
      calories: 245.6, proteinG: -3, carbsG: 2000, fatG: 7.4,
      ingredients: [{ index: 0, name: "tôm sú" }, { index: 1, name: "Nước me (AI tự đặt)" }],
    }), "gpt-5-mini");
    await expect(estimate(memberRecipe, known)).resolves.toEqual({
      calories: 246, proteinG: 0, carbsG: 1000, fatG: 7,
      ingredients: [
        { original: "tom su", name: "Tôm sú", matched: true },
        { original: "Me chua", name: "Me chua", matched: false },
      ],
    });
  });

  it("schema sai → ném lỗi (service đổi thành 503); không có key → null", async () => {
    await expect(realEstimator(fakeClient({ calories: "nhiều" }), "m")(memberRecipe, known)).rejects.toThrow();
    await expect(realEstimator(null, "m")(memberRecipe, known)).resolves.toBeNull();
  });
});

describe("estimateRecipeFromPost", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findPost.mockResolvedValue({ memberRecipe });
    mocks.listIngredients.mockResolvedValue(known.map((name) => ({ name })));
  });

  it("gửi công thức tự viết + tên nguyên liệu trong thư viện; không ghi DB", async () => {
    mocks.estimate.mockResolvedValue({ calories: 300, proteinG: 20, carbsG: 30, fatG: 8, ingredients: [] });
    await expect(estimateRecipeFromPost("p1")).resolves.toMatchObject({ calories: 300 });
    expect(mocks.estimate).toHaveBeenCalledWith(memberRecipe, known);
  });

  it.each([
    ["không có key", async () => mocks.estimate.mockResolvedValue(null), 503, "AI_NOT_CONFIGURED"],
    ["API lỗi", async () => mocks.estimate.mockRejectedValue(new Error("timeout")), 503, "AI_UNAVAILABLE"],
  ])("%s → 503 kèm code", async (_label, arrange, status, code) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await arrange();
    await expect(estimateRecipeFromPost("p1")).rejects.toMatchObject({ status, details: { code } });
  });

  it("bài không có / không có công thức tự viết → 404 / 422", async () => {
    mocks.findPost.mockResolvedValue(null);
    await expect(estimateRecipeFromPost("p1")).rejects.toMatchObject({ status: 404 });
    mocks.findPost.mockResolvedValue({ memberRecipe: null });
    await expect(estimateRecipeFromPost("p1")).rejects.toMatchObject({ status: 422 });
  });
});
