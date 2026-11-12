import { api } from "../../api/client";
import type { AuthResponse, ChangePasswordInput, LoginInput, RegisterInput } from "../../types";

// Refresh token nằm trong cookie httpOnly do backend đặt (GĐ4); JavaScript không đọc được. Body chỉ có access token + người dùng.

export async function login(input: LoginInput & { remember: boolean }) {
  return (await api.post<AuthResponse>("/auth/login", input)).data;
}

export async function register(input: RegisterInput) {
  return (await api.post<AuthResponse>("/auth/register", input)).data;
}

/** Thu hồi refresh token phía server và xóa cookie. */
export async function logout() {
  await api.post("/auth/logout", {});
}

/** Đổi mật khẩu: các thiết bị khác bị đăng xuất; thiết bị này nhận phiên mới. */
export async function changePassword(input: ChangePasswordInput) {
  return (await api.post<AuthResponse>("/auth/change-password", input)).data;
}

/** Luôn trả cùng một câu, dù email có tài khoản hay không. */
export async function forgotPassword(email: string) {
  return (await api.post<{ message: string }>("/auth/forgot-password", { email })).data;
}

/** Đặt mật khẩu mới bằng token trong email; xong thì mọi phiên cũ bị đăng xuất (không tự đăng nhập). */
export async function resetPassword(token: string, password: string) {
  return (await api.post<{ message: string }>("/auth/reset-password", { token, password })).data;
}
