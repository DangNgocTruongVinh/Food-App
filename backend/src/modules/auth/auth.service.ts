import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { accountLockedError } from "../../middleware/auth.js";
import { HttpError } from "../../utils/http-error.js";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "./auth.schema.js";
import { issueRefreshToken, revokeUserRefreshTokens } from "./refresh-token.service.js";

/** Access token ngắn hạn (GĐ4): hết hạn thì frontend gọi /api/auth/refresh bằng cookie refresh token. */
export const ACCESS_TOKEN_TTL = "15m";

export function issueAccessToken(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export const publicUser = (user: { id: string; email: string; name: string; role: Role }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});

export type Session = { token: string; user: ReturnType<typeof publicUser>; refreshToken: string; remember: boolean };

/** Phiên mới: access token + refresh token (chuỗi mới). Controller đặt refresh token vào cookie. */
async function startSession(user: { id: string; email: string; name: string; role: Role }, remember: boolean): Promise<Session> {
  const refreshToken = await issueRefreshToken(prisma, user.id, remember);
  return { token: issueAccessToken(user), user: publicUser(user), refreshToken, remember };
}

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "Email này đã được sử dụng.");
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(input.password, 12),
      profile: { create: {} },
    },
  });
  // Quyết định #11: đăng ký xong mặc định nhớ đăng nhập.
  return startSession(user, true);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
  }
  // Kiểm tra mật khẩu trước: người không biết mật khẩu không dò được tài khoản nào đang bị khóa.
  if (user.lockedAt) throw accountLockedError();
  return startSession(user, input.remember);
}

/**
 * Đổi mật khẩu: sai mật khẩu hiện tại → 400 (không dùng 401 để frontend không hiểu nhầm là hết phiên). Thu hồi mọi refresh token
 * (đăng xuất mọi thiết bị khác), ghi passwordChangedAt (access token cũ bị requireAuth từ chối), rồi mở phiên mới cho thiết bị này.
 */
export async function changePassword(userId: string, input: ChangePasswordInput, remember: boolean): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Mật khẩu hiện tại không đúng.");
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  const now = new Date();
  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now } });
    await revokeUserRefreshTokens(tx, userId, now);
    return issueRefreshToken(tx, userId, remember, undefined, now);
  });
  return { token: issueAccessToken(user), user: publicUser(user), refreshToken, remember };
}
