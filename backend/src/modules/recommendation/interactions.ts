import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

// Tương tác người dùng × món (GĐ3b-R), suy ra từ bảng có sẵn, không có bảng sự kiện riêng:
//   EATEN  — bữa đã đánh dấu đã ăn (MealPlanItem.completed), thời điểm = ngày của bữa;
//   POSTED — đăng bài cộng đồng gắn món; LIKED — thích bài người khác có gắn món;
//   PLANNED — món có trong thực đơn (không phải bản nháp) nhưng chưa ăn: chỉ dùng cho thuật toán 1. Thực đơn do hệ thống
//   tự xếp, nên đưa tín hiệu này vào thuật toán 2 sẽ tạo vòng lặp phản hồi (món được gợi ý → vào thực đơn → được gợi ý nhiều hơn).

export type InteractionKind = "EATEN" | "POSTED" | "LIKED" | "PLANNED";
export type CollaborativeKind = Exclude<InteractionKind, "PLANNED">;
/** `count` = số lần cùng loại, cùng ngày (đã gom ở SQL). */
export type Interaction<K extends InteractionKind = InteractionKind> = { userId: string; recipeId: string; kind: K; at: Date; count: number };

export const CONTENT_WEIGHTS: Record<InteractionKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2, PLANNED: 0.5 };
export const COLLABORATIVE_WEIGHTS: Record<CollaborativeKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2 };
export const DECAY_TAU_DAYS = 30;
const DAY_MS = 86_400_000;

/** e^(−Δ/τ), Δ = số ngày từ lúc tương tác tới nay (tương tác ở tương lai, vd. bữa đã ăn sớm, tính Δ = 0). */
export function decay(at: Date, now: Date, tauDays = DECAY_TAU_DAYS) {
  return Math.exp(-Math.max(0, (now.getTime() - at.getTime()) / DAY_MS) / tauDays);
}

// ---------- Nạp từ DB (gom theo người dùng × món × loại × ngày bằng GROUP BY trong SQL, không tải từng dòng) ----------


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
