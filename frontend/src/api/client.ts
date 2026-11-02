import axios from "axios";
import { clearAuthSession, getAuthToken } from "../features/auth/auth.storage";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthSession();
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    // Tài khoản bị Admin khóa khi đang dùng: đăng xuất và về trang đăng nhập kèm lời báo (backend chặn mọi API bằng 403 ACCOUNT_LOCKED).
    if (isAccountLockedError(error)) {
      clearAuthSession();
      if (!location.pathname.startsWith("/login")) location.href = "/login?locked=1";
    }
    return Promise.reject(error);
  },
);

export function isAccountLockedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 403 && error.response.data?.details?.code === "ACCOUNT_LOCKED";
}

export function getApiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? "Không thể kết nối máy chủ.";
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}
