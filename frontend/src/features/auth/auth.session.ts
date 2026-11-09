import type { QueryClient } from "@tanstack/react-query";
import type { AuthResponse, User } from "../../types";
import { clearAuthSession, isSessionRemembered, saveAuthSession, saveStoredUser } from "./auth.storage";

export function acceptAuthSession(queryClient: QueryClient, session: AuthResponse, remember = true) {
  queryClient.clear();
  saveAuthSession(session, remember);
  return session.user;
}

/** Phiên mới của cùng người dùng (sau đổi mật khẩu): giữ kho lưu hiện tại ("Nhớ đăng nhập"), không xóa dữ liệu đã tải. */
export function renewAuthSession(session: AuthResponse) {
  saveAuthSession(session, isSessionRemembered());
  return session.user;
}

export function endAuthSession(queryClient: QueryClient) {
  queryClient.clear();
  clearAuthSession();
}

export function updateAuthUser(user: User) {
  saveStoredUser(user);
  return user;
}
