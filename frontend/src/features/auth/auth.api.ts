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
