import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { CollaborativeKind, Interaction, InteractionKind } from "./interactions.js";

// Nạp tương tác từ DB (GĐ3b-R4): gom theo người dùng × món × loại × ngày bằng GROUP BY trong SQL, không tải từng dòng.


type Db = Pick<PrismaClient, "$queryRaw">;
type Row = { userId: string; recipeId: string; kind: InteractionKind; at: Date; count: number };

/** Đã ăn, đăng bài gắn món, thích bài người khác gắn món; `forUser` = chỉ của một người (thuật toán 1). */
const collaborativeSql = (forUser?: string) => {
  const eaten = forUser ? Prisma.sql`AND mp."userId" = ${forUser}` : Prisma.empty;
  const posted = forUser ? Prisma.sql`AND p."authorId" = ${forUser}` : Prisma.empty;
  const liked = forUser ? Prisma.sql`AND l."userId" = ${forUser}` : Prisma.empty;
  return Prisma.sql`
    SELECT mp."userId" AS "userId", mi."recipeId" AS "recipeId", 'EATEN' AS "kind", d."date" AS "at", COUNT(*)::int AS "count"
    FROM "MealPlanItem" mi
    JOIN "MealPlanDay" d ON d."id" = mi."dayId"
    JOIN "MealPlan" mp ON mp."id" = d."mealPlanId"
    WHERE mi."completed" = true ${eaten}
    GROUP BY mp."userId", mi."recipeId", d."date"
    UNION ALL
    SELECT p."authorId", p."recipeId", 'POSTED', date_trunc('day', p."createdAt"), COUNT(*)::int
    FROM "CommunityPost" p
    WHERE p."recipeId" IS NOT NULL ${posted}
    GROUP BY p."authorId", p."recipeId", date_trunc('day', p."createdAt")
    UNION ALL
    SELECT l."userId", p."recipeId", 'LIKED', date_trunc('day', l."createdAt"), COUNT(*)::int
    FROM "CommunityLike" l
    JOIN "CommunityPost" p ON p."id" = l."postId"
    WHERE p."recipeId" IS NOT NULL AND l."userId" <> p."authorId" ${liked}
    GROUP BY l."userId", p."recipeId", date_trunc('day', l."createdAt")`;
};

/** Toàn bộ tương tác cho thuật toán 2 (không có "có trong thực đơn" — xem chú thích đầu file). Chỉ dùng để tính số liệu tổng hợp. */
export async function loadCollaborativeInteractions(db: Db = prisma): Promise<Interaction<CollaborativeKind>[]> {
  const rows = await db.$queryRaw<Row[]>(collaborativeSql());
  return rows.map((row) => ({ ...row, kind: row.kind as CollaborativeKind, count: Number(row.count) }));
}

/** Lịch sử của một người cho thuật toán 1: 3 loại trên + món có trong thực đơn (không phải bản nháp) chưa ăn. */
export async function loadUserInteractions(userId: string, db: Db = prisma): Promise<Interaction[]> {
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    ${collaborativeSql(userId)}
    UNION ALL
    SELECT mp."userId", mi."recipeId", 'PLANNED', d."date", COUNT(*)::int
    FROM "MealPlanItem" mi
    JOIN "MealPlanDay" d ON d."id" = mi."dayId"
    JOIN "MealPlan" mp ON mp."id" = d."mealPlanId"
    WHERE mi."completed" = false AND mp."status" <> 'DRAFT' AND mp."userId" = ${userId}
    GROUP BY mp."userId", mi."recipeId", d."date"`);
  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}
