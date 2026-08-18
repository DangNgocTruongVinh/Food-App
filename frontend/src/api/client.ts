import axios from "axios";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nutriplan_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("nutriplan_token");
      localStorage.removeItem("nutriplan_user");
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export function getApiError(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message ?? "Không thể kết nối máy chủ.";
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}
