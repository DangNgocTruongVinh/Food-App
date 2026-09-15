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
    return Promise.reject(error);
  },
);

export function getApiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? "Không thể kết nối máy chủ.";
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}
