import { prisma } from "../lib/prisma.js";

/**
 * Quyền và trạng thái khóa đọc từ DB ở mỗi request đã đăng nhập (không lấy từ JWT), để khóa tài khoản
 * hoặc đổi quyền có hiệu lực ngay. Một truy vấn theo khóa chính, chỉ 2 cột.
 * Test dùng bản giả chung trong src/test/setup.ts.
 */
export function getAccountStatus(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { role: true, lockedAt: true } });
}
