import { prisma } from "../../lib/prisma.js";
import { HIDDEN_RECIPE_MESSAGE, isRecipeHidden } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import type { CreateCommunityPostBody } from "./community.schema.js";

const COMMUNITY_FEED_LIMIT = 30;
const authorSelect = { id: true, name: true } as const;
/** Tóm tắt công thức gắn trong bài: chỉ các cột thẻ hiển thị cần, không lấy nguyên liệu/các bước. */
export const communityRecipeSelect = {
  id: true, name: true, imageUrl: true, calories: true, prepMinutes: true, cookMinutes: true, hiddenAt: true,
} as const;

type CommunityRecipeRow = { hiddenAt: Date | null } & Record<string, unknown>;

/** Bài cũ gắn món đã ẩn vẫn hiện thẻ công thức, kèm cờ hidden để frontend gắn nhãn "đã ngừng sử dụng". */
function toRecipeSummary<T extends CommunityRecipeRow>(recipe: T | null) {
  if (!recipe) return null;
  const { hiddenAt, ...summary } = recipe;
  return { ...summary, hidden: hiddenAt !== null };
}

/** Chỉ gắn được công thức có sẵn và còn dùng (chưa bị Admin ẩn). */
async function assertAttachableRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true, hiddenAt: true } });
  if (!recipe) throw new HttpError(422, "Công thức đính kèm không tồn tại.");
  if (isRecipeHidden(recipe)) throw new HttpError(422, HIDDEN_RECIPE_MESSAGE);
}

export async function listCommunityPosts(userId: string) {
  const posts = await prisma.communityPost.findMany({
    orderBy: { createdAt: "desc" },
    take: COMMUNITY_FEED_LIMIT,
    include: {
      author: { select: authorSelect },
      recipe: { select: communityRecipeSelect },
      likes: { where: { userId }, select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return posts.map(({ likes, _count, recipe, ...post }) => ({
    ...post,
    recipe: toRecipeSummary(recipe),
    likedByMe: likes.length > 0,
    likeCount: _count.likes,
    commentCount: _count.comments,
  }));
}

export async function createCommunityPost(authorId: string, { content, recipeId }: CreateCommunityPostBody) {
  if (recipeId) await assertAttachableRecipe(recipeId);
  const post = await prisma.communityPost.create({
    data: { authorId, content, recipeId: recipeId ?? null },
    include: { author: { select: authorSelect }, recipe: { select: communityRecipeSelect } },
  });

  return { ...post, recipe: toRecipeSummary(post.recipe), likedByMe: false, likeCount: 0, commentCount: 0, comments: [] };
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
 */
export async function deleteCommunityPost(postId: string, actor: CommunityActor) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post || (!actor.isAdmin && post.authorId !== actor.userId)) throw new HttpError(404, POST_NOT_FOUND);
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { relatedId: postId, type: { in: [...POST_NOTIFICATION_TYPES] } } }),
    prisma.communityPost.delete({ where: { id: postId } }),
  ]);
}

/** Xóa bình luận: Admin xóa mọi bình luận, người dùng chỉ bình luận của mình; xóa kèm thông báo của bình luận đó. */
export async function deleteCommunityComment(commentId: string, actor: CommunityActor) {
  const comment = await prisma.communityComment.findUnique({ where: { id: commentId }, select: { id: true, authorId: true } });
  if (!comment || (!actor.isAdmin && comment.authorId !== actor.userId)) {
    throw new HttpError(404, "Không tìm thấy bình luận.");
  }
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { dedupeKey: `community-comment:${commentId}` } }),
    prisma.communityComment.delete({ where: { id: commentId } }),
  ]);
}

/** Danh sách bài cho Admin kiểm duyệt: mới nhất trước, kèm tác giả (có email), bình luận và số lượt thích. */
export async function listCommunityPostsForModeration(page: number, pageSize: number) {
  const [total, posts] = await Promise.all([
    prisma.communityPost.count(),
    prisma.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { id: true, name: true, email: true } },
        recipe: { select: communityRecipeSelect },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, email: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);
  const items = posts.map(({ _count, recipe, ...post }) => ({
    ...post, recipe: toRecipeSummary(recipe), likeCount: _count.likes, commentCount: _count.comments,
  }));
  return { items, total, page, pageSize };
}
