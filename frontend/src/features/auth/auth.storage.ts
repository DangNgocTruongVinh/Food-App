import type { AuthResponse, User } from "../../types";

const tokenKey = "nutriplan_token";
const userKey = "nutriplan_user";

export function getAuthToken() {
  return localStorage.getItem(tokenKey);
}

export function getStoredUser(): User | null {
  const saved = localStorage.getItem(userKey);
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

export function saveAuthSession({ token, user }: AuthResponse) {
  localStorage.setItem(tokenKey, token);
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function saveStoredUser(user: User) {
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}
