import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { recordAdminAction } from "../admin/admin-audit.service.js";
import { readMemberRecipe } from "./community-member-recipe.js";
import type { UpdateCommunityPostBody } from "./community.schema.js";
import {
  EMPTY_POST_MESSAGE, feedInclude, moderationPostInclude, toFeedPost, toModerationPost, viewerAllergies,
} from "./community.service.js";

const POST_NOT_FOUND = "Không tìm thấy bài viết.";

/**
 * Tác giả sửa bài: nội dung và công thức tự viết (null = bỏ). Bài người khác hoặc không tồn tại → 404 (không lộ sự tồn tại).
 * Bài đã đính kèm món có sẵn thì không thêm công thức tự viết; sửa xong bài vẫn phải còn chữ, công thức hoặc ảnh.
 */
export async function updateCommunityPost(authorId: string, postId: string, { content, memberRecipe }: UpdateCommunityPostBody) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId }, select: { authorId: true, recipeId: true, _count: { select: { images: true } } },
  });
  if (!post || post.authorId !== authorId) throw new HttpError(404, POST_NOT_FOUND);
  if (memberRecipe && post.recipeId) throw new HttpError(422, "Bài đã đính kèm món có sẵn nên không thêm công thức tự viết được.");
  if (!content && !memberRecipe && !post.recipeId && !post._count.images) throw new HttpError(422, EMPTY_POST_MESSAGE);
  const [updated, allergies] = await Promise.all([prisma.communityPost.update({
    where: { id: postId },
    data: { content, memberRecipe: memberRecipe ?? Prisma.DbNull },
    include: feedInclude(authorId),
  }), viewerAllergies(authorId)]);
  return toFeedPost(updated, allergies);
}

/** Admin ẩn/hiện bài vi phạm (không xóa): ghi nhật ký Admin trong cùng transaction. Không đổi trạng thái → không ghi. */
export async function setCommunityPostHidden(actorId: string, postId: string, hidden: boolean) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId }, select: { authorId: true, hiddenAt: true, author: { select: { email: true } } },
  });
  if (!post) throw new HttpError(404, POST_NOT_FOUND);
  if ((post.hiddenAt !== null) !== hidden) {
    await prisma.$transaction([
      prisma.communityPost.update({ where: { id: postId }, data: { hiddenAt: hidden ? new Date() : null } }),
      recordAdminAction(prisma, {
        actorId, action: hidden ? "POST_HIDE" : "POST_SHOW", targetType: "COMMUNITY_POST", targetId: postId,
        targetLabel: post.author.email, details: { authorId: post.authorId },
      }),
    ]);
  }
  return getCommunityPostForModeration(postId);
}

/** Một bài cho Admin (form "Chuyển thành công thức" điền trước từ công thức tự viết). */
export async function getCommunityPostForModeration(postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, include: moderationPostInclude });
  if (!post) throw new HttpError(404, POST_NOT_FOUND);
  return toModerationPost(post);
}

/**
 * "Chuyển thành công thức": gọi trong transaction tạo món của Admin. Bài phải có công thức tự viết và chưa được chuyển;
 * gắn bài với món mới ("Đã được thêm vào thư viện") và ghi nhật ký Admin. Lỗi → cả món mới cũng không được tạo.
 */
export async function linkPromotedPost(tx: Prisma.TransactionClient, actorId: string, postId: string, recipe: { id: string; name: string }) {
  const post = await tx.communityPost.findUnique({
    where: { id: postId }, select: { authorId: true, memberRecipe: true, promotedRecipeId: true, author: { select: { email: true } } },
  });
  if (!post) throw new HttpError(404, POST_NOT_FOUND);
  if (!readMemberRecipe(post.memberRecipe)) throw new HttpError(422, "Bài viết này không có công thức tự viết để chuyển.");
  if (post.promotedRecipeId) throw new HttpError(409, "Công thức của bài này đã được thêm vào thư viện.");
  // Điều kiện promotedRecipeId: null chống hai Admin chuyển cùng lúc (người sau nhận 409, món của họ không được tạo).
  const linked = await tx.communityPost.updateMany({ where: { id: postId, promotedRecipeId: null }, data: { promotedRecipeId: recipe.id } });
  if (!linked.count) throw new HttpError(409, "Công thức của bài này đã được thêm vào thư viện.");
  await recordAdminAction(tx, {
    actorId, action: "POST_PROMOTE", targetType: "COMMUNITY_POST", targetId: postId, targetLabel: post.author.email,
    details: { authorId: post.authorId, recipeId: recipe.id, recipeName: recipe.name },
  });
}
