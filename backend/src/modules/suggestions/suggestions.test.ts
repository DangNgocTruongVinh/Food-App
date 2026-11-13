import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters", findPantry: vi.fn(), findIngredients: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  pantryItem: { findMany: mocks.findPantry },
  recipeIngredient: { findMany: mocks.findIngredients },
} }));
const { default: routes, suggestionLimit } = await import("./suggestions.routes.js");

const app = testApp("/api/suggestions", routes);
const token = (sub = "user-a") => `Bearer ${jwt.sign({ sub, email: "a@nouri.vn" }, mocks.secret)}`;
const get = (q: string, sub?: string) => request(app, `/api/suggestions/foods?q=${encodeURIComponent(q)}`, { token: token(sub) });

beforeEach(() => {
  vi.clearAllMocks();
  suggestionLimit.reset();
  mocks.findPantry.mockResolvedValue([{ name: "Trứng gà ta" }, { name: "Sữa tươi" }]);
  mocks.findIngredients.mockResolvedValue([{ name: "Trứng" }, { name: "Sữa đậu nành" }, { name: "Sữa tươi" }, { name: "Cà chua" }]);
});

describe("GET /api/suggestions/foods", () => {
  it("cần đăng nhập", async () => {
    expect((await request(app, "/api/suggestions/foods?q=tr")).status).toBe(401);
    expect(mocks.findPantry).not.toHaveBeenCalled();
  });

  it("chỉ đọc kho của chính người dùng (userId từ JWT) + nguyên liệu món đang hiện; kho trước, bỏ trùng, kèm nhóm dị ứng", async () => {
    const response = await get("sua");
    expect(mocks.findPantry).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a" } }));
    expect(mocks.findIngredients).toHaveBeenCalledWith(expect.objectContaining({ where: { recipe: { hiddenAt: null, deletedAt: null } } }));
    expect(response.body).toEqual([
      { name: "Sữa tươi", source: "PANTRY", allergyGroups: ["Sữa"] },
      { name: "Sữa đậu nành", source: "RECIPE", allergyGroups: ["Đậu nành"] },
    ]);
    expect((await get("trung")).body.map((item: { name: string }) => item.name)).toEqual(["Trứng gà ta", "Trứng"]);
  });

  it("câu tìm trống hoặc quá dài bị từ chối; tối đa 8 gợi ý", async () => {
    expect((await get("")).status).toBe(422);
    expect((await get("a".repeat(61))).status).toBe(422);
    mocks.findIngredients.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ name: `Rau số ${index}` })));
    expect((await get("rau")).body).toHaveLength(8);
  });

  it("giới hạn 120 lần/phút cho mỗi người dùng (người khác không bị ảnh hưởng)", async () => {
    for (let index = 0; index < 120; index += 1) expect((await get("tr")).status).toBe(200);
    const blocked = await get("tr");
    expect(blocked.status).toBe(429);
    expect((await get("tr", "user-b")).status).toBe(200);
  });
});
