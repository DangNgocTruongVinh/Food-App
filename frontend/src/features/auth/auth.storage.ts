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

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Trình duyệt có thể chặn storage (chặn dữ liệu trang, chế độ riêng tư, khung nhúng): chính việc truy cập localStorage
// cũng có thể ném lỗi. Mọi lần đọc/ghi đi qua các hàm dưới đây, lỗi coi như không có dữ liệu. Không ghi được vào đâu thì
// phiên giữ trong bộ nhớ của tab (mất khi tải lại trang) thay vì làm sập ứng dụng.
const memory = new Map<string, string>();
const memoryStore: KeyValueStore = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
  removeItem: (key) => { memory.delete(key); },
};

function browserStore(kind: "local" | "session"): KeyValueStore | null {
  try {
    return (kind === "local" ? globalThis.localStorage : globalThis.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

function readItem(store: KeyValueStore | null, key: string) {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(store: KeyValueStore | null, key: string, value: string) {
  try {
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeItem(store: KeyValueStore | null, key: string) {
  try {
    store?.removeItem(key);
  } catch {
    // Không xóa được thì bỏ qua: lần đọc sau vẫn đi qua readItem.
  }
}

const allStores = () => [browserStore("local"), browserStore("session"), memoryStore];

function migrateLegacyKeys() {
  for (const store of [browserStore("local"), browserStore("session")]) {
    for (const [key, legacyKey] of Object.entries(legacyKeys)) {
      const value = readItem(store, legacyKey);
      if (value === null) continue;
      if (readItem(store, key) === null) writeItem(store, key, value);
      removeItem(store, legacyKey);
    }
  }
}

export function getRememberLoginPreference() {
  migrateLegacyKeys();
  return readItem(browserStore("local"), rememberPreferenceKey) !== "false";
}

export function saveRememberLoginPreference(remember: boolean) {
  writeItem(browserStore("local"), rememberPreferenceKey, String(remember));
}

// Kho đang giữ phiên; sessionStorage ưu tiên vì nó chỉ có khi người dùng chủ động không nhớ đăng nhập.
function activeStore() {
  migrateLegacyKeys();
  const session = browserStore("session");
  if (readItem(session, tokenKey)) return session;
  const local = browserStore("local");
  if (readItem(local, tokenKey)) return local;
  if (readItem(memoryStore, tokenKey)) return memoryStore;
  return null;
}

export function isSessionRemembered() {
  const store = activeStore();
  return store === null || store !== browserStore("session");
}

export function getAuthToken() {
  return readItem(activeStore(), tokenKey);
}

export function getStoredUser(): User | null {
  const saved = readItem(activeStore() ?? browserStore("local"), userKey);
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

/** "Nhớ đăng nhập" giữ phiên trong localStorage; không nhớ thì chỉ sống trong tab hiện tại (sessionStorage). */
export function saveAuthSession({ token, user }: AuthResponse, remember = true) {
  clearAuthSession();
  const preferred = browserStore(remember ? "local" : "session");
  if (writeItem(preferred, tokenKey, token) && writeItem(preferred, userKey, JSON.stringify(user))) return;
  removeItem(preferred, tokenKey);
  memoryStore.setItem(tokenKey, token);
  memoryStore.setItem(userKey, JSON.stringify(user));
}

export function saveStoredUser(user: User) {
  const store = activeStore() ?? browserStore("local");
  if (!writeItem(store, userKey, JSON.stringify(user))) memoryStore.setItem(userKey, JSON.stringify(user));
}

export function clearAuthSession() {
  for (const store of allStores()) {
    removeItem(store, tokenKey);
    removeItem(store, userKey);
  }
}
