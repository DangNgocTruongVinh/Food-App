import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";

const COMMUNITY_FEED_LIMIT = 30;
const authorSelect = { id: true, name: true } as const;

export async function listCommunityPosts(userId: string) {
  const posts = await prisma.communityPost.findMany({
    orderBy: { createdAt: "desc" },
    take: COMMUNITY_FEED_LIMIT,
    include: {
      author: { select: authorSelect },
      likes: { where: { userId }, select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return posts.map(({ likes, _count, ...post }) => ({
    ...post,
    likedByMe: likes.length > 0,
    likeCount: _count.likes,
    commentCount: _count.comments,
  }));
}

export async function createCommunityPost(authorId: string, content: string) {
  const post = await prisma.communityPost.create({
    data: { authorId, content },
    include: { author: { select: authorSelect } },
  });

  return { ...post, likedByMe: false, likeCount: 0, commentCount: 0, comments: [] };
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
