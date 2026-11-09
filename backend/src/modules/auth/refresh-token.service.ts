import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { accountLockedError } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http-error.js";

// Refresh token (GĐ4). Token gốc (32 byte ngẫu nhiên) chỉ nằm trong cookie httpOnly; DB lưu SHA-256 của nó (token đủ ngẫu nhiên
// nên không cần bcrypt). Xoay vòng: mỗi lần làm mới đánh dấu token cũ usedAt và phát token mới cùng chuỗi (familyId).
// Token đã xoay bị dùng lại sau REUSE_GRACE_MS → coi là bị đánh cắp, thu hồi cả chuỗi. Trong REUSE_GRACE_MS (hai tab làm mới
// cùng lúc) chỉ trả 401 REFRESH_RACE, không thu hồi: tab thua gửi lại với cookie mới mà tab thắng vừa nhận.

export const REFRESH_COOKIE = "nouri_refresh";
export const REFRESH_COOKIE_PATH = "/api/auth";
const DAY_MS = 86_400_000;
/** "Nhớ đăng nhập": 30 ngày kể từ lần làm mới gần nhất. Không nhớ: cookie phiên, phía server hết hạn sau 1 ngày không dùng. */
export const REMEMBER_TTL_MS = 30 * DAY_MS;
export const SESSION_TTL_MS = DAY_MS;
export const REUSE_GRACE_MS = 10_000;
export const REFRESH_RACE_CODE = "REFRESH_RACE";

type Db = Prisma.TransactionClient | typeof prisma;

export const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");

const invalidRefresh = () => new HttpError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

/** Phát refresh token mới (chuỗi mới khi đăng nhập, cùng chuỗi khi xoay vòng). Trả token gốc để đặt vào cookie. */
export async function issueRefreshToken(db: Db, userId: string, remember: boolean, familyId: string = randomUUID(), now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await db.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(token), familyId, remember, expiresAt: new Date(now.getTime() + (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS)) },
  });
  return token;
}

/** Thu hồi mọi refresh token còn hiệu lực của một người (khóa tài khoản, đổi mật khẩu); dọn luôn token đã hết hạn. */
export async function revokeUserRefreshTokens(db: Db, userId: string, now = new Date()) {
  await db.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: now } } });
  await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
}

const revokeFamily = (db: Db, familyId: string, now: Date) =>
  db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });

const findByToken = (token: string) => prisma.refreshToken.findUnique({
  where: { tokenHash: hashRefreshToken(token) },
  include: { user: { select: { id: true, email: true, name: true, role: true, lockedAt: true } } },
});

/** Làm mới: kiểm tra token, phát refresh token mới cùng chuỗi (xoay vòng). Trả người dùng để cấp access token mới. */
export async function rotateRefreshToken(token: string | undefined, now = new Date()) {
  const record = token ? await findByToken(token) : null;
  if (!record || record.revokedAt || record.expiresAt <= now) throw invalidRefresh();
  if (record.usedAt) {
    if (now.getTime() - record.usedAt.getTime() < REUSE_GRACE_MS) {
      throw new HttpError(401, "Phiên đang được làm mới ở nơi khác.", { code: REFRESH_RACE_CODE });
    }
    // Dùng lại token đã xoay: người giữ token cũ không phải chủ phiên hiện tại → thu hồi cả chuỗi (cả người dùng thật phải đăng nhập lại).
    await revokeFamily(prisma, record.familyId, now);
    throw invalidRefresh();
  }
  if (record.user.lockedAt) {
    await revokeUserRefreshTokens(prisma, record.userId, now);
    throw accountLockedError();
  }
  const refreshToken = await prisma.$transaction(async (tx) => {
    // Điều kiện usedAt/revokedAt null: hai request cùng token chỉ một request xoay được.
    const marked = await tx.refreshToken.updateMany({ where: { id: record.id, usedAt: null, revokedAt: null }, data: { usedAt: now } });
    if (!marked.count) throw new HttpError(401, "Phiên đang được làm mới ở nơi khác.", { code: REFRESH_RACE_CODE });
    return issueRefreshToken(tx, record.userId, record.remember, record.familyId, now);
  });
  return { user: record.user, refreshToken, remember: record.remember };
}

/** Đăng xuất: thu hồi cả chuỗi của token trong cookie (không có/không hợp lệ thì bỏ qua). */
export async function revokeRefreshToken(token: string | undefined, now = new Date()) {
  if (!token) return;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) }, select: { familyId: true } });
  if (record) await revokeFamily(prisma, record.familyId, now);
}

/** "Nhớ đăng nhập" của phiên hiện tại (để giữ nguyên kiểu cookie khi đổi mật khẩu); không rõ thì coi là nhớ. */
export async function rememberOf(token: string | undefined) {
  if (!token) return true;
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) }, select: { remember: true } });
  return record?.remember ?? true;
}
