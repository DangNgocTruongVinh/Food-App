import type { AdminAuditAction, AdminAuditTargetType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { AdminAuditLogQuery } from "./admin-audit.schema.js";

// Nhật ký thao tác Admin. Mỗi thao tác ghi đúng một dòng trong cùng transaction với thao tác (thao tác lỗi thì không có
// nhật ký, ghi nhật ký lỗi thì thao tác bị hủy). details chỉ chứa các trường liệt kê dưới đây, không bao giờ chép body
// của request: không lưu mật khẩu, token, publicId ảnh, nội dung bài viết/bình luận.

/** Chi tiết theo loại thao tác (chỉ các trường này được lưu). */
export type AdminAuditDetails =
  | { slug: string } // RECIPE_CREATE, RECIPE_DELETE
  | { changedFields: string[] } // RECIPE_UPDATE: tên trường đã đổi, không lưu giá trị
  | { replacedUploadedImage: boolean } // RECIPE_IMAGE_REPLACE: có thay ảnh Cloudinary cũ hay không
  | { authorId: string; imageCount: number; commentCount: number; likeCount: number; hasRecipe: boolean } // POST_DELETE
  | { authorId: string; postId: string }; // COMMENT_DELETE

export type AdminAuditEntry = {
  actorId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  /** Tên món hoặc email người dùng/tác giả tại thời điểm thao tác. */
  targetLabel?: string | null;
  details?: AdminAuditDetails;
};

type AuditClient = Pick<Prisma.TransactionClient, "adminAuditLog">;

/**
 * Tạo dòng nhật ký bằng client của transaction (interactive) hoặc prisma (trả PrismaPromise để đưa vào
 * $transaction([...])). Không dùng async để giữ nguyên PrismaPromise.
 */
export function recordAdminAction(db: AuditClient, { actorId, action, targetType, targetId, targetLabel, details }: AdminAuditEntry) {
  return db.adminAuditLog.create({
    data: { actorId, action, targetType, targetId, targetLabel: targetLabel ?? null, ...(details ? { details } : {}) },
    select: { id: true },
  });
}

export async function listAdminAuditLogs(query: AdminAuditLogQuery) {
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, action: true, targetType: true, targetId: true, targetLabel: true, details: true, createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
