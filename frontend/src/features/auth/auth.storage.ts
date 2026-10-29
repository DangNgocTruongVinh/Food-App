import type { AuthResponse, User } from "../../types";

const tokenKey = "nouri_token";
const userKey = "nouri_user";
// Chỉ lưu lựa chọn của checkbox "Nhớ đăng nhập"; không chứa token và không bị xóa khi đăng xuất.
const rememberPreferenceKey = "nouri_remember_login";

// Key trước khi đổi tên nutriplan → nouri. Đọc rồi chuyển sang key mới để người dùng đang đăng nhập không bị đăng xuất.
const legacyKeys: Record<string, string> = {
  [tokenKey]: "nutriplan_token",
  [userKey]: "nutriplan_user",
  [rememberPreferenceKey]: "nutriplan_remember_login",
};

function migrateLegacyKeys() {
  for (const storage of [localStorage, sessionStorage]) {
    for (const [key, legacyKey] of Object.entries(legacyKeys)) {
      const value = storage.getItem(legacyKey);
      if (value === null) continue;
      if (storage.getItem(key) === null) storage.setItem(key, value);
      storage.removeItem(legacyKey);
    }
  }
}

export function getRememberLoginPreference() {
  migrateLegacyKeys();
  return localStorage.getItem(rememberPreferenceKey) !== "false";
}

export function saveRememberLoginPreference(remember: boolean) {
  localStorage.setItem(rememberPreferenceKey, String(remember));
}

// "Nhớ đăng nhập" giữ phiên trong localStorage; không nhớ thì chỉ sống trong tab hiện tại (sessionStorage).
function storageFor(remember: boolean) {
  return remember ? localStorage : sessionStorage;
}

// Kho đang giữ phiên; sessionStorage ưu tiên vì nó chỉ có khi người dùng chủ động không nhớ đăng nhập.
function activeStorage() {
  migrateLegacyKeys();
  if (sessionStorage.getItem(tokenKey)) return sessionStorage;
  if (localStorage.getItem(tokenKey)) return localStorage;
  return null;
}

export function isSessionRemembered() {
  return activeStorage() !== sessionStorage;
}

export function getAuthToken() {
  return activeStorage()?.getItem(tokenKey) ?? null;
}

export function getStoredUser(): User | null {
  const saved = (activeStorage() ?? localStorage).getItem(userKey);
  if (!saved) return null;
  try {
    const user: unknown = JSON.parse(saved);
    if (
      typeof user === "object" && user !== null &&
      typeof (user as User).id === "string" &&
      typeof (user as User).name === "string" &&
      typeof (user as User).email === "string"
    ) return user as User;
  } catch {
    // A broken local session must not prevent AuthProvider from rendering.
  }
  clearAuthSession();
  return null;
}

export function saveAuthSession({ token, user }: AuthResponse, remember = true) {
  clearAuthSession();
  const storage = storageFor(remember);
  storage.setItem(tokenKey, token);
  storage.setItem(userKey, JSON.stringify(user));
}

export function saveStoredUser(user: User) {
  (activeStorage() ?? localStorage).setItem(userKey, JSON.stringify(user));
}

export function clearAuthSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(tokenKey);
    storage.removeItem(userKey);
  }
}
