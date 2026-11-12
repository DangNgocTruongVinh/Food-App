import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { passwordChangedEmail, passwordResetEmail } from "../../services/email-templates.js";
import { sendMailInBackground } from "../../services/email.service.js";
import { HttpError } from "../../utils/http-error.js";
import { revokeUserRefreshTokens } from "./refresh-token.service.js";

// Quên mật khẩu: POST /forgot-password luôn trả cùng một câu (không lộ email nào đã đăng ký; email gửi nền nên thời gian
// phản hồi cũng như nhau). Token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256, hết hạn 30 phút, dùng một lần; yêu cầu mới xóa
// token cũ. POST /reset-password đổi mật khẩu, thu hồi mọi refresh token, gửi email báo "Mật khẩu vừa được đổi".

export const RESET_TOKEN_TTL_MINUTES = 30;
export const FORGOT_PASSWORD_MESSAGE = "Nếu email có tài khoản Nouri, chúng tôi đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục Spam).";
const INVALID_LINK = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.";
const LOCKED = "Tài khoản này đang bị khóa nên không đặt lại mật khẩu được. Vui lòng liên hệ quản trị viên.";

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function requestPasswordReset(email: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true, email: true, name: true, lockedAt: true } });
  // Không có tài khoản hoặc bị khóa: không làm gì nhưng trả cùng câu như khi gửi được.
  if (!user || user.lockedAt) return { message: FORGOT_PASSWORD_MESSAGE };
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000) },
    }),
  ]);
  const link = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  sendMailInBackground(passwordResetEmail(user, link, RESET_TOKEN_TTL_MINUTES));
  return { message: FORGOT_PASSWORD_MESSAGE };
}

export async function resetPassword(token: string, password: string, now = new Date()) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, usedAt: true, expiresAt: true, user: { select: { id: true, email: true, name: true, lockedAt: true } } },
  });
  if (!record || record.usedAt || record.expiresAt <= now) throw new HttpError(400, INVALID_LINK);
  if (record.user.lockedAt) throw new HttpError(403, LOCKED);
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    // usedAt: null trong điều kiện: hai lần gửi cùng lúc thì chỉ một lần đổi được mật khẩu.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (!claimed.count) throw new HttpError(400, INVALID_LINK);
    await tx.user.update({ where: { id: record.user.id }, data: { passwordHash, passwordChangedAt: now } });
    await revokeUserRefreshTokens(tx, record.user.id, now);
  });
  sendMailInBackground(passwordChangedEmail(record.user, now));
  return { message: "Đã đặt mật khẩu mới. Hãy đăng nhập lại." };
}
