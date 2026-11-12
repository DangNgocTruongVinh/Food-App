import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { detectImageFormat } from "../../services/image-file.js";
import { stripImageMetadata } from "../../services/image-sanitize.js";
import { deleteImageQuietly, IMAGE_FOLDERS, type UploadedImage, uploadImage } from "../../services/image-upload.service.js";
import { HIDDEN_RECIPE_MESSAGE, isRecipeHidden } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { recordAdminAction } from "../admin/admin-audit.service.js";
import { reviewCommunityPost, reviewData, reviewTextOf } from "./community-ai-review.js";
import { memberRecipeAllergens, readMemberRecipe } from "./community-member-recipe.js";
import type { CreateCommunityPostBody } from "./community.schema.js";

const COMMUNITY_FEED_LIMIT = 30;
// isSample: tài khoản mẫu minh họa (GĐ3b-R4) — giao diện gắn nhãn "Tài khoản mẫu". Không trả email.
const authorSelect = { id: true, name: true, isSample: true } as const;
/** Tóm tắt công thức gắn trong bài: chỉ các cột thẻ hiển thị cần, không lấy nguyên liệu/các bước. */
export const communityRecipeSelect = {
  id: true, name: true, imageUrl: true, calories: true, prepMinutes: true, cookMinutes: true, hiddenAt: true, deletedAt: true,
} as const;
/** Ảnh trong bài: chỉ URL và thứ tự (publicId chỉ dùng nội bộ để xóa). */
const postImagesInclude = { images: { select: { url: true, position: true }, orderBy: { position: "asc" } } } as const;
/** Món trong thư viện được Admin tạo từ công thức tự viết của bài ("Đã được thêm vào thư viện"). */
export const promotedRecipeInclude = { promotedRecipe: { select: { id: true, name: true } } } as const;

/** Dị ứng trong hồ sơ người xem (chưa có hồ sơ → không cảnh báo). */
export async function viewerAllergies(userId: string) {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId }, select: { allergies: true } });
  return profile?.allergies ?? [];
}

/**
 * Phần chung của bài trả cho bảng tin: công thức tự viết đã đọc lại, cảnh báo dị ứng theo hồ sơ người xem, cờ "bị ẩn"
 * (chỉ tác giả còn thấy bài bị ẩn), cờ "chờ duyệt" (AI đánh dấu). Bỏ hiddenAt, pendingReviewAt, aiReviewReason khỏi dữ liệu trả về.
 */
export function withMemberRecipe<T extends { memberRecipe: unknown; hiddenAt: Date | null; pendingReviewAt?: Date | null; aiReviewReason?: string | null }>(
  post: T, allergies: string[],
) {
  const { hiddenAt, pendingReviewAt, aiReviewReason: _reason, ...rest } = post;
  const memberRecipe = readMemberRecipe(post.memberRecipe);
  return {
    ...rest, memberRecipe, memberRecipeAllergens: memberRecipeAllergens(memberRecipe, allergies),
    hidden: Boolean(hiddenAt), pendingReview: Boolean(pendingReviewAt),
  };
}

/** Bài người khác thấy được: chưa bị Admin ẩn và không chờ duyệt; tác giả luôn thấy bài của mình. */
export const visiblePostWhere = (userId: string) => ({ OR: [{ hiddenAt: null, pendingReviewAt: null }, { authorId: userId }] });

type CommunityRecipeRow = { hiddenAt: Date | null; deletedAt?: Date | null } & Record<string, unknown>;

/** Bài cũ gắn món đã ẩn vẫn hiện thẻ công thức, kèm cờ hidden để frontend gắn nhãn "đã ngừng sử dụng". */
function toRecipeSummary<T extends CommunityRecipeRow>(recipe: T | null) {
  if (!recipe) return null;
  const { hiddenAt, deletedAt, ...summary } = recipe;
  return { ...summary, hidden: hiddenAt !== null || Boolean(deletedAt), deleted: Boolean(deletedAt) };
}

/** Chỉ gắn được công thức có sẵn và còn dùng (chưa bị Admin ẩn). */
async function assertAttachableRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true, hiddenAt: true, deletedAt: true } });
  if (!recipe) throw new HttpError(422, "Công thức đính kèm không tồn tại.");
  if (isRecipeHidden(recipe)) throw new HttpError(422, HIDDEN_RECIPE_MESSAGE);
}

/** Dữ liệu một bài trên bảng tin (người xem userId: đã thích chưa). Dùng chung cho bảng tin và API sửa bài. */
export function feedInclude(userId: string) {
  return {
    author: { select: authorSelect },
    recipe: { select: communityRecipeSelect },
    ...promotedRecipeInclude,
    ...postImagesInclude,
    likes: { where: { userId }, select: { userId: true } },
    savedBy: { where: { userId }, select: { userId: true } },
    comments: { orderBy: { createdAt: "asc" }, include: { author: { select: authorSelect } } },
    _count: { select: { likes: true, comments: true } },
  } as const;
}

type FeedRow = Prisma.CommunityPostGetPayload<{ include: ReturnType<typeof feedInclude> }>;

export function toFeedPost({ likes, savedBy, _count, recipe, ...post }: FeedRow, allergies: string[]) {
  return {
    ...withMemberRecipe(post, allergies),
    recipe: toRecipeSummary(recipe),
    savedByMe: savedBy.length > 0,
    likedByMe: likes.length > 0,
    likeCount: _count.likes,
    commentCount: _count.comments,
  };
}

export async function listCommunityPosts(userId: string) {
  const [posts, allergies] = await Promise.all([prisma.communityPost.findMany({
    // Bài Admin đã ẩn hoặc AI đánh dấu chờ duyệt: chỉ tác giả còn thấy (kèm ghi chú), người khác không thấy.
    where: visiblePostWhere(userId),
    orderBy: { createdAt: "desc" },
    take: COMMUNITY_FEED_LIMIT,
    include: feedInclude(userId),
  }), viewerAllergies(userId)]);
  return posts.map((post) => toFeedPost(post, allergies));
}

/** Xóa EXIF/GPS rồi tải lần lượt lên nouri/posts; một ảnh lỗi thì xóa các ảnh đã tải trước đó. */
async function uploadPostImages(files: Buffer[]) {
  const uploaded: UploadedImage[] = [];
  try {
    for (const file of files) {
      const clean = await stripImageMetadata(file, detectImageFormat(file) ?? "jpg");
      uploaded.push(await uploadImage(clean, IMAGE_FOLDERS.posts));
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((image) => deleteImageQuietly(image.publicId)));
    throw error;
  }
}

export const EMPTY_POST_MESSAGE = "Bài viết cần có nội dung, công thức hoặc ảnh.";

/**
 * Đăng bài: cần có ít nhất một trong bốn (chữ, món có sẵn, công thức tự viết, ảnh); món có sẵn và công thức tự viết không
 * đi cùng nhau (Zod). Tải hết ảnh trước rồi tạo bài cùng ảnh trong một lệnh (nested create, Prisma chạy trong transaction);
 * tạo bài lỗi thì xóa các ảnh đã tải để không để ảnh mồ côi.
 */
export async function createCommunityPost(authorId: string, { content, recipeId, memberRecipe }: CreateCommunityPostBody, files: Buffer[] = []) {
  if (!content && !recipeId && !memberRecipe && !files.length) throw new HttpError(422, EMPTY_POST_MESSAGE);
  if (recipeId) await assertAttachableRecipe(recipeId);
  const images = await uploadPostImages(files);
  try {
    // AI kiểm duyệt (ảnh đã lên Cloudinary nên gửi URL): nghi vấn → chờ duyệt; không có key/lỗi → null, đăng như thường.
    const review = await reviewCommunityPost({ text: reviewTextOf(content, memberRecipe), imageUrls: images.map((image) => image.url) });
    const [post, allergies] = await Promise.all([prisma.communityPost.create({
      data: {
        authorId, content, recipeId: recipeId ?? null, ...(memberRecipe ? { memberRecipe } : {}), ...(review?.flagged ? reviewData(review) : {}),
        ...(images.length ? { images: { create: images.map((image, position) => ({ ...image, position })) } } : {}),
      },
      include: { author: { select: authorSelect }, recipe: { select: communityRecipeSelect }, ...promotedRecipeInclude, ...postImagesInclude },
    }), viewerAllergies(authorId)]);
    return {
      ...withMemberRecipe(post, allergies), recipe: toRecipeSummary(post.recipe), likedByMe: false, likeCount: 0, commentCount: 0, comments: [],
    };
  } catch (error) {
    await Promise.all(images.map((image) => deleteImageQuietly(image.publicId)));
    throw error;
  }
}

export async function toggleCommunityLike(userId: string, postId: string) {
  const [post, actor] = await Promise.all([
    prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");

  const existingLike = await prisma.communityLike.findUnique({ where: { postId_userId: { postId, userId } } });
  const liked = !existingLike;
  const notificationKey = `community-like:${postId}:${userId}`;

  if (existingLike) {
    await prisma.$transaction([
      prisma.communityLike.delete({ where: { postId_userId: { postId, userId } } }),
      prisma.notification.deleteMany({ where: { dedupeKey: notificationKey } }),
    ]);
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.communityLike.create({ data: { postId, userId } });
      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            userId: post.authorId,
            type: "COMMUNITY_LIKE",
            title: "Bài viết được yêu thích",
            message: `${actor?.name ?? "Một thành viên"} đã thích bài viết của bạn.`,
            relatedId: postId,
            actionUrl: `/community?post=${encodeURIComponent(postId)}`,
            dedupeKey: notificationKey,
          },
        });
      }
    });
  }

  return { liked, likeCount: await prisma.communityLike.count({ where: { postId } }) };
}

export async function addCommunityComment(authorId: string, postId: string, content: string) {
  const [post, actor] = await Promise.all([
    prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } }),
    prisma.user.findUnique({ where: { id: authorId }, select: { name: true } }),
  ]);
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");

  return prisma.$transaction(async (tx) => {
    const created = await tx.communityComment.create({
      data: { postId, authorId, content },
      include: { author: { select: authorSelect } },
    });
    if (post.authorId !== authorId) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          type: "COMMUNITY_COMMENT",
          title: "Bình luận mới",
          message: `${actor?.name ?? "Một thành viên"} đã bình luận bài viết của bạn.`,
          relatedId: postId,
          actionUrl: `/community?post=${encodeURIComponent(postId)}`,
          dedupeKey: `community-comment:${created.id}`,
        },
      });
    }
    return created;
  });
}

/** Người thực hiện xóa: Admin xóa mọi bài/bình luận; người dùng chỉ xóa của mình. userId luôn lấy từ JWT. */
export type CommunityActor = { userId: string; isAdmin: boolean };

const POST_NOT_FOUND = "Không tìm thấy bài viết.";
// Thông báo cộng đồng gắn với bài qua relatedId = postId (không có FK nên phải xóa tay). COMMUNITY_FOLLOW gắn với người dùng.
const POST_NOTIFICATION_TYPES = ["COMMUNITY_LIKE", "COMMUNITY_COMMENT", "COMMUNITY_REPLY"] as const;

/**
 * Xóa bài viết — dùng chung cho "Xóa bài của tôi" và Admin kiểm duyệt. Bài không tồn tại hoặc không thuộc quyền → 404
 * (không lộ sự tồn tại). Like/bình luận tự xóa theo bài (Cascade); thông báo liên quan xóa trong cùng transaction.
 * Admin kiểm duyệt thì ghi thêm nhật ký Admin trong transaction đó (không lưu nội dung bài).
 */
export async function deleteCommunityPost(postId: string, actor: CommunityActor) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true, authorId: true, recipeId: true, author: { select: { email: true } }, images: { select: { publicId: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!post || (!actor.isAdmin && post.authorId !== actor.userId)) throw new HttpError(404, POST_NOT_FOUND);
  const images = post.images ?? [];
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { relatedId: postId, type: { in: [...POST_NOTIFICATION_TYPES] } } }),
    prisma.communityPost.delete({ where: { id: postId } }),
    ...(actor.isAdmin ? [recordAdminAction(prisma, {
      actorId: actor.userId, action: "POST_DELETE", targetType: "COMMUNITY_POST", targetId: postId, targetLabel: post.author?.email,
      details: {
        authorId: post.authorId, imageCount: images.length, commentCount: post._count?.comments ?? 0, likeCount: post._count?.likes ?? 0,
        hasRecipe: Boolean(post.recipeId),
      },
    })] : []),
  ]);
  // Sau khi bài đã xóa (ảnh trong DB xóa theo bài): dọn ảnh trên Cloudinary, lỗi chỉ ghi log.
  await Promise.all(images.map((image) => deleteImageQuietly(image.publicId)));
}

/**
 * Xóa bình luận: Admin xóa mọi bình luận, người dùng chỉ bình luận của mình; xóa kèm thông báo của bình luận đó.
 * Admin kiểm duyệt thì ghi thêm nhật ký Admin trong cùng transaction (không lưu nội dung bình luận).
 */
export async function deleteCommunityComment(commentId: string, actor: CommunityActor) {
  const comment = await prisma.communityComment.findUnique({
    where: { id: commentId }, select: { id: true, authorId: true, postId: true, author: { select: { email: true } } },
  });
  if (!comment || (!actor.isAdmin && comment.authorId !== actor.userId)) {
    throw new HttpError(404, "Không tìm thấy bình luận.");
  }
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { dedupeKey: `community-comment:${commentId}` } }),
    prisma.communityComment.delete({ where: { id: commentId } }),
    ...(actor.isAdmin ? [recordAdminAction(prisma, {
      actorId: actor.userId, action: "COMMENT_DELETE", targetType: "COMMUNITY_COMMENT", targetId: commentId,
      targetLabel: comment.author?.email, details: { authorId: comment.authorId, postId: comment.postId },
    })] : []),
  ]);
}

const moderationInclude = {
  recipe: { select: communityRecipeSelect },
  ...promotedRecipeInclude,
  ...postImagesInclude,
  comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, email: true } } } },
  _count: { select: { likes: true, comments: true } },
} as const;

type ModerationRow = Prisma.CommunityPostGetPayload<{ include: typeof moderationInclude & { author: { select: { id: true; name: true; email: true } } } }>;

/** Bài cho Admin: kèm công thức tự viết (không cảnh báo dị ứng), cờ "đã ẩn", món đã chuyển vào thư viện. */
export function toModerationPost({ _count, recipe, ...post }: ModerationRow) {
  return {
    ...withMemberRecipe(post, []), aiReviewReason: post.aiReviewReason, recipe: toRecipeSummary(recipe),
    likeCount: _count.likes, commentCount: _count.comments,
  };
}

export const moderationPostInclude = { author: { select: { id: true, name: true, email: true } }, ...moderationInclude } as const;

/** Danh sách bài cho Admin kiểm duyệt: mới nhất trước, kèm tác giả (có email), bình luận và số lượt thích. */
export async function listCommunityPostsForModeration(page: number, pageSize: number, filter: "all" | "ai" = "all") {
  // "ai": bài AI đánh dấu đang chờ duyệt.
  const where = filter === "ai" ? { pendingReviewAt: { not: null } } : {};
  const [total, posts] = await Promise.all([
    prisma.communityPost.count({ where }),
    prisma.communityPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { id: true, name: true, email: true } },
        ...moderationInclude,
      },
    }),
  ]);
  const items = posts.map(toModerationPost);
  return { items, total, page, pageSize };
}

/**
 * GET /api/community/saved (UC25): bài đã lưu của chính người dùng, mới lưu trước. Bài bị xóa đã tự mất (xóa theo); bài bị Admin ẩn
 * hoặc AI đánh dấu chờ duyệt không hiện (cùng điều kiện với bảng tin), hiện lại khi được hiện/duyệt.
 */
export async function listSavedPosts(userId: string) {
  const [saved, allergies] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId, post: visiblePostWhere(userId) }, orderBy: { createdAt: "desc" }, take: COMMUNITY_FEED_LIMIT,
      select: { post: { include: feedInclude(userId) } },
    }),
    viewerAllergies(userId),
  ]);
  return saved.map(({ post }) => toFeedPost(post, allergies));
}

/** PUT/DELETE /api/community/:postId/save: lưu / bỏ lưu (gọi lại vẫn cùng kết quả). Bài không thấy được (không có, bị ẩn) → 404. */
export async function setPostSaved(userId: string, postId: string, saved: boolean) {
  if (!saved) {
    await prisma.savedPost.deleteMany({ where: { userId, postId } });
    return { postId, saved: false };
  }
  const post = await prisma.communityPost.findFirst({ where: { id: postId, ...visiblePostWhere(userId) }, select: { id: true } });
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");
  await prisma.savedPost.createMany({ data: [{ userId, postId }], skipDuplicates: true });
  return { postId, saved: true };
}
