import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { recordAdminAction } from "./admin-audit.service.js";
import type { AdminUserListQuery } from "./admin-users.schema.js";

export async function listUsersForAdmin(query: AdminUserListQuery) {
  const where: Prisma.UserWhereInput = query.search
    ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, name: true, email: true, role: true, lockedAt: true, createdAt: true,
        _count: { select: { communityPosts: true, mealPlans: true } },
      },
    }),
  ]);
  const items = users.map(({ _count, ...user }) => ({
    ...user, locked: user.lockedAt !== null, postCount: _count.communityPosts, mealPlanCount: _count.mealPlans,
  }));
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Khóa/mở khóa: có hiệu lực ngay ở request kế tiếp (requireAuth đọc lockedAt từ DB). Không tự khóa mình (400),
 * không khóa/mở khóa Admin khác (403). Khóa lại tài khoản đang khóa thì giữ thời điểm khóa ban đầu.
 * Nhật ký Admin ghi trong cùng transaction, chỉ khi trạng thái thực sự đổi.
 */
export async function setUserLock(actorId: string, targetId: string, locked: boolean) {
  if (actorId === targetId) throw new HttpError(400, "Bạn không thể tự khóa hoặc mở khóa tài khoản của mình.");
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, role: true, lockedAt: true } });
  if (!target) throw new HttpError(404, "Không tìm thấy người dùng.");
  if (target.role === "ADMIN") throw new HttpError(403, "Không thể khóa hoặc mở khóa tài khoản Admin khác.");

  const lockedAt = locked ? target.lockedAt ?? new Date() : null;
  const changed = (target.lockedAt !== null) !== locked;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: targetId }, data: { lockedAt }, select: { id: true, lockedAt: true } });
    if (changed) {
      await recordAdminAction(tx, {
        actorId, action: locked ? "USER_LOCK" : "USER_UNLOCK", targetType: "USER", targetId, targetLabel: target.email,
      });
    }
    // GĐ4: khi khóa, thu hồi toàn bộ refresh token của tài khoản trong cùng transaction này
    // (vd. tx.refreshToken.deleteMany({ where: { userId: targetId } })).
    return { ...user, locked: user.lockedAt !== null };
  });
}
