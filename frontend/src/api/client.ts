import axios, { type InternalAxiosRequestConfig } from "axios";
import { clearAuthSession, getAuthToken, isSessionRemembered, saveAuthSession } from "../features/auth/auth.storage";
import type { AuthResponse } from "../types";

// withCredentials: gửi cookie refresh token (httpOnly, chỉ cho /api/auth) khi frontend và API khác origin (VITE_API_URL).
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

/** Lời gọi làm mới/đăng xuất tự xử lý lỗi của chúng; không làm mới rồi gọi lại cho đăng nhập/đăng ký (401 = sai mật khẩu). */
const isSessionCall = (url = "") => url.startsWith("/auth/refresh") || url.startsWith("/auth/logout");
const isCredentialsCall = (url = "") => url.startsWith("/auth/login") || url.startsWith("/auth/register");

const isRefreshRace = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 401 && error.response.data?.details?.code === "REFRESH_RACE";

/**
 * Lấy access token mới bằng cookie refresh token. Hai tab làm mới cùng lúc thì backend trả REFRESH_RACE cho tab thua: lúc đó
 * cookie đã là token mới của tab thắng, nên gửi lại một lần là được. Trả null khi phiên đã hết; ném lỗi ACCOUNT_LOCKED.
 */
async function requestNewAccessToken(): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data } = await api.post<AuthResponse>("/auth/refresh", {});
      saveAuthSession(data, isSessionRemembered());
      return data.token;
    } catch (error) {
      if (isAccountLockedError(error)) throw error;
      if (!isRefreshRace(error)) return null;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return null;
}

let refreshing: Promise<string | null> | null = null;

/** Một lần làm mới cho mọi request cùng gặp 401 trong tab này. */
export function refreshAccessToken() {
  refreshing ??= requestNewAccessToken().finally(() => { refreshing = null; });
  return refreshing;
}

function signOut(path: string) {
  clearAuthSession();
  if (!location.pathname.startsWith("/login")) location.href = path;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetriableConfig | undefined;
    if (isSessionCall(config?.url)) return Promise.reject(error);

    // Access token (15 phút) hết hạn: làm mới một lần rồi gọi lại request ban đầu.
    if (error.response?.status === 401 && config && !config._authRetried && config.headers?.Authorization && !isCredentialsCall(config.url)) {
      config._authRetried = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return await api.request(config);
        }
      } catch (refreshError) {
        if (isAccountLockedError(refreshError)) {
          signOut("/login?locked=1");
          return Promise.reject(error);
        }
        // Request gọi lại vẫn lỗi: trả lỗi đó (các nhánh dưới đã xử lý khi nó đi qua interceptor).
        return Promise.reject(refreshError);
      }
    }
    if (error.response?.status === 401) signOut("/login");
    // Tài khoản bị Admin khóa khi đang dùng: đăng xuất và về trang đăng nhập kèm lời báo (backend chặn mọi API bằng 403 ACCOUNT_LOCKED).
    if (isAccountLockedError(error)) signOut("/login?locked=1");
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
