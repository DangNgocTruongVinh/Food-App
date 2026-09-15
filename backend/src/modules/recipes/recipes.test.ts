import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import recipeRoutes from "./recipes.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: { recipe: { findMany: mocks.findMany, findUnique: mocks.findUnique } },
}));

const app = testApp("/api/recipes", recipeRoutes);
const userId = "user-a";
const recipeId = "cm12345678901234567890123";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "demo@nouri.vn" }, mocks.secret)}`;
const recipe = {
  id: recipeId,
  slug: "uc-ga-rau-cu",
  name: "Ức gà rau củ",
  description: "Bữa ăn cân bằng.",
  instructions: ["Áp chảo thịt gà", "Thêm rau củ"],
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 2,
  calories: 420,
  proteinG: 38,
  carbsG: 32,
  fatG: 14,
  fiberG: 7,
  cuisine: "Việt Nam",
  dietTags: ["BALANCED", "HIGH_PROTEIN"],
  ingredients: [{
    id: "ingredient-a", recipeId, name: "Ức gà", quantity: 300, unit: "G", optional: false,
  }],
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([recipe]);
  mocks.findUnique.mockResolvedValue(recipe);
});

afterEach(() => vi.restoreAllMocks());

describe("Recipes HTTP contract (no database)", () => {
  it("lists recipes with ingredients using the existing name order", async () => {
    const response = await request(app, "/api/recipes", { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify([recipe])) });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {}, include: { ingredients: true }, orderBy: { name: "asc" },
    });
  });

  it("maps search and cuisine query parameters to the existing Prisma filters", async () => {
    const response = await request(
      app,
      `/api/recipes?search=${encodeURIComponent("Ức gà")}&cuisine=${encodeURIComponent("Việt Nam")}`,
      { token: token() },
    );
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: "Ức gà", mode: "insensitive" },
        cuisine: "Việt Nam",
      },
      include: { ingredients: true },
      orderBy: { name: "asc" },
    });
  });

  it("preserves empty search and cuisine parameters as no filters", async () => {
    await request(app, "/api/recipes?search=&cuisine=", { token: token() });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {}, include: { ingredients: true }, orderBy: { name: "asc" },
    });
  });

  it("gets one recipe with its ingredients", async () => {
    const response = await request(app, `/api/recipes/${recipeId}`, { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(recipe)) });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: recipeId }, include: { ingredients: true },
    });
  });

  it("returns the existing 404 response when a recipe does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await request(app, `/api/recipes/${recipeId}`, { token: token() })).toEqual({
      status: 404, body: { message: "Không tìm thấy công thức." },
    });
  });

  it.each([
    ["/api/recipes", "list"],
    [`/api/recipes/${recipeId}`, "detail"],
  ])("requires authentication for %s", async (path, operation) => {
    expect(await request(app, path)).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
    expect(operation === "list" ? mocks.findMany : mocks.findUnique).not.toHaveBeenCalled();
  });

  it("uses the shared error response when Prisma list fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findMany.mockRejectedValue(new Error("database unavailable"));
    expect(await request(app, "/api/recipes", { token: token() })).toEqual({
      status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." },
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("Recipes validation", () => {
  it.each([
    `/api/recipes?search=${"a".repeat(81)}`,
    `/api/recipes?cuisine=${"a".repeat(51)}`,
    "/api/recipes?search=a&search=b",
  ])("rejects invalid list query parameters: %s", async (path) => {
    const response = await request(app, path, { token: token() });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipe id before calling Prisma", async () => {
    const response = await request(app, "/api/recipes/not-a-cuid", { token: token() });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
