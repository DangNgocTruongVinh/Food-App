import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import { HttpError } from "../../utils/http-error.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./auth.cookies.js";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "./auth.schema.js";
import { changePassword, issueAccessToken, login, publicUser, register, type Session } from "./auth.service.js";
import { REFRESH_RACE_CODE, rememberOf, revokeRefreshToken, rotateRefreshToken } from "./refresh-token.service.js";

/** Refresh token chỉ đi trong cookie httpOnly, không có trong body (JavaScript của trang không đọc được). */
function sendSession(res: Response, status: number, session: Session) {
  setRefreshCookie(res, session.refreshToken, session.remember);
  res.status(status).json({ token: session.token, user: session.user });
}

export async function registerController(req: ValidatedRequest<RegisterInput>, res: Response) {
  sendSession(res, 201, await register(req.body));
}

export async function loginController(req: ValidatedRequest<LoginInput>, res: Response) {
  sendSession(res, 200, await login(req.body));
}

export async function refreshController(req: Request, res: Response) {
  try {
    const { user, refreshToken, remember } = await rotateRefreshToken(readRefreshCookie(req));
    sendSession(res, 200, { token: issueAccessToken(user), user: publicUser(user), refreshToken, remember });
  } catch (error) {
    // Hai tab làm mới cùng lúc: giữ cookie (tab kia vừa nhận cookie mới); lỗi khác: xóa cookie hỏng/đã thu hồi.
    const race = error instanceof HttpError && (error.details as { code?: string } | undefined)?.code === REFRESH_RACE_CODE;
    if (!race) clearRefreshCookie(res);
    throw error;
  }
}

export async function logoutController(req: Request, res: Response) {
  await revokeRefreshToken(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function changePasswordController(req: ValidatedRequest<ChangePasswordInput>, res: Response) {
  const remember = await rememberOf(readRefreshCookie(req));
  sendSession(res, 200, await changePassword((req as unknown as AuthenticatedRequest).userId, req.body, remember));
}
