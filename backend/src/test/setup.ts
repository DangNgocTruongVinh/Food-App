import { afterEach, vi } from "vitest";
import { useSeedCatalog } from "../services/catalog/catalog-build.js";

// Test đọc danh mục qua cùng hàm dựng như khi chạy thật, nguồn là dữ liệu seed cố định (không cần database).
useSeedCatalog();

/**
 * requireAuth đọc quyền và trạng thái khóa từ DB ở mỗi request. Các test route giả lập Prisma riêng theo module,
 * nên trạng thái tài khoản được giả lập chung ở đây: mặc định là USER chưa bị khóa.
 * Test cần trường hợp khác thì đổi bằng vi.mocked(getAccountStatus).mockResolvedValue(...).
 * Vitest 3: vi.resetAllMocks() đưa bản giả về đúng mặc định truyền vào vi.fn(...) này.
 */
vi.mock("../services/account-status.service.js", () => ({
  getAccountStatus: vi.fn(async () => ({ role: "USER", lockedAt: null })),
}));

/**
 * Sau mỗi test nhường một nhịp cho vòng lặp sự kiện (macrotask). Các test đồng bộ dài chạy liền nhau (ma trận an toàn: 50–100 giây
 * trong một file) chỉ nhường microtask, nên worker không kịp xử lý trả lời RPC của Vitest trong 60 giây và lệnh test kết thúc mã lỗi 1
 * ("[vitest-worker]: Timeout calling onTaskUpdate") dù mọi test đều đạt.
 */
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
