import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type AccountStatus = { role: Role; lockedAt: Date | null; passwordChangedAt?: Date | null };

/**
 * Quyền và trạng thái khóa đọc từ DB ở mỗi request đã đăng nhập (không lấy từ JWT), để khóa tài khoản
 * hoặc đổi quyền có hiệu lực ngay. Một truy vấn theo khóa chính, chỉ 3 cột.
 * Test dùng bản giả chung trong src/test/setup.ts.
 */
export function getAccountStatus(userId: string): Promise<AccountStatus | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: { role: true, lockedAt: true, passwordChangedAt: true } });
}
