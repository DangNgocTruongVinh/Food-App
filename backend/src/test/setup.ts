import { vi } from "vitest";

/**
 * requireAuth đọc quyền và trạng thái khóa từ DB ở mỗi request. Các test route giả lập Prisma riêng theo module,
 * nên trạng thái tài khoản được giả lập chung ở đây: mặc định là USER chưa bị khóa.
 * Test cần trường hợp khác thì đổi bằng vi.mocked(getAccountStatus).mockResolvedValue(...).
 * Vitest 3: vi.resetAllMocks() đưa bản giả về đúng mặc định truyền vào vi.fn(...) này.
 */
vi.mock("../services/account-status.service.js", () => ({
  getAccountStatus: vi.fn(async () => ({ role: "USER", lockedAt: null })),
}));
