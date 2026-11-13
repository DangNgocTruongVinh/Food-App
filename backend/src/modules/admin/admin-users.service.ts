import type { Prisma } from "@prisma/client";
import { revokeUserRefreshTokens } from "../auth/refresh-token.service.js";
import { prisma } from "../../lib/prisma.js";
import { foldSearchText } from "../../services/recipe-search.js";
import { HttpError } from "../../utils/http-error.js";
import { recordAdminAction } from "./admin-audit.service.js";
import type { AdminUserListQuery } from "./admin-users.schema.js";

const userListSelect = {
  id: true, name: true, email: true, role: true, lockedAt: true, isSample: true, createdAt: true,
  _count: { select: { communityPosts: true, mealPlans: true } },
} as const;

/** Tên hoặc email khớp câu tìm không dấu: mọi từ khớp đầu một từ của tên, hoặc email chứa câu tìm ("nguyen" ra "Nguyễn"). */
function userMatches(user: { name: string; email: string }, search: string) {
  const query = foldSearchText(search);
  const nameWords = foldSearchText(user.name).split(" ");
  return user.email.toLowerCase().includes(search.trim().toLowerCase())
    || query.split(" ").every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)));
}

export async function listUsersForAdmin(query: AdminUserListQuery) {
  const skip = (query.page - 1) * query.pageSize;
  if (query.search) {
    // shortcut: lọc không dấu ở ứng dụng trên toàn bộ tài khoản (đồ án vài trăm tài khoản); nhiều hơn thì dùng unaccent của PostgreSQL.
    const all = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true } });
    const matched = all.filter((user) => userMatches(user, query.search!));
    const ids = matched.slice(skip, skip + query.pageSize).map((user) => user.id);
    const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: userListSelect });
    const users = ids.map((id) => rows.find((row) => row.id === id)!).filter(Boolean);
    return { items: users.map(toListItem), total: matched.length, page: query.page, pageSize: query.pageSize };
  }
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, skip, take: query.pageSize, select: userListSelect }),
  ]);
  return { items: users.map(toListItem), total, page: query.page, pageSize: query.pageSize };
}

function toListItem({ _count, ...user }: Prisma.UserGetPayload<{ select: typeof userListSelect }>) {
  return { ...user, locked: user.lockedAt !== null, postCount: _count.communityPosts, mealPlanCount: _count.mealPlans };
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
    // Khóa: thu hồi mọi refresh token trong cùng transaction (không làm mới được nữa; access token bị requireAuth chặn ngay).
    if (locked) await revokeUserRefreshTokens(tx, targetId);
    return { ...user, locked: user.lockedAt !== null };
  });
}
