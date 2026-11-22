import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountStatus } from "../../services/account-status.service.js";
import { requestWithCookies, testApp } from "../../test/http-test-utils.js";

// Audit S3: "Chuyển thành công thức" gọi AI ước tính dinh dưỡng → tối đa 20 lần/ngày mỗi tài khoản Admin. Thao tác kiểm duyệt
// khác trong /api/admin không bị giới hạn. Service ước tính được giả lập (không gọi OpenAI, không cần DB).
const mocks = vi.hoisted(() => ({ secret: "nouri-test-only-secret-at-least-32-characters", estimate: vi.fn() }));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("./admin-recipe-estimate.service.js", () => ({ estimateRecipeFromPost: mocks.estimate }));
const { default: adminRoutes, recipeEstimateLimit } = await import("./admin.routes.js");

const app = testApp("/api/admin", adminRoutes);
const postId = "cm44444444444444444444444";
const path = `/api/admin/community/posts/${postId}/recipe-estimate`;
const tokenOf = (sub: string) => `Bearer ${jwt.sign({ sub, email: `${sub}@nouri.vn` }, mocks.secret)}`;
const estimate = (sub = "admin-a") => requestWithCookies(app, path, { method: "POST", token: tokenOf(sub) });

beforeEach(() => {
  recipeEstimateLimit.reset();
  vi.mocked(getAccountStatus).mockResolvedValue({ role: "ADMIN", lockedAt: null } as Awaited<ReturnType<typeof getAccountStatus>>);
  mocks.estimate.mockResolvedValue({ name: "Bánh xèo", aiEstimated: true });
});

describe("Giới hạn ước tính dinh dưỡng bằng AI theo tài khoản Admin (audit S3)", () => {
  it("20 lần/ngày; lần thứ 21 → 429 kèm Retry-After, không gọi AI; Admin khác cùng IP vẫn ước tính được", async () => {
    for (let i = 1; i <= 20; i += 1) expect((await estimate()).status).toBe(200);
    const limited = await estimate();
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      message: "Bạn đã dùng hết 20 lượt ước tính dinh dưỡng bằng AI trong ngày. Vui lòng thử lại sau hoặc tự nhập dinh dưỡng.",
    });
    expect(Number(limited.retryAfter)).toBeGreaterThan(0);
    expect(mocks.estimate).toHaveBeenCalledTimes(20);
    expect((await estimate("admin-b")).status).toBe(200);
  });
});
