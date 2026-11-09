import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getApiError, isAccountLockedError } from "./client";
import { getAuthToken, getStoredUser, saveAuthSession } from "../features/auth/auth.storage";
import type { InternalAxiosRequestConfig } from "axios";

const originalAdapter = api.defaults.adapter;
beforeEach(() => {
  for (const name of ["localStorage", "sessionStorage"]) {
    const stored = new Map<string, string>();
    vi.stubGlobal(name, {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
    });
  }
  vi.stubGlobal("location", { pathname: "/profile", href: "/profile" });
});
afterEach(() => { api.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

describe("HTTP client compatibility (no network)", () => {
  it.each([false, true])("adds Bearer only when a stored token exists (%s)", async (authenticated) => {
    if (authenticated) saveAuthSession({ token: "token-a", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    const adapter = vi.fn(async (config) => ({ config, data: {}, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await api.get("/profile");
    expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe(authenticated ? "Bearer token-a" : undefined);
    expect(api.defaults.baseURL).toBe(import.meta.env.VITE_API_URL || "/api");
  });

  it.each(["/profile", "/login", "/login/nested"])("keeps existing 401 redirect behavior on %s", async (path) => {
    location.pathname = path; location.href = path;
    saveAuthSession({ token: "expired", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    let error: AxiosError;
    api.defaults.adapter = async (config) => {
      error = new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, { config, data: { message: "Phiên hết hạn" }, status: 401, statusText: "Unauthorized", headers: {} });
      throw error;
    };
    await expect(api.get("/profile")).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAuthToken()).toBeNull(); expect(localStorage.getItem("nouri_user")).toBeNull();
    expect(location.href).toBe(path.startsWith("/login") ? path : "/login");
  });

  it("attaches and clears a non-remembered session on 401", async () => {
    saveAuthSession({ token: "tab-token", user: { id: "a", name: "A", email: "a@nouri.vn" } }, false);
    api.defaults.adapter = async (config) => {
      expect(config.headers.get("Authorization")).toBe("Bearer tab-token");
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, status: 401, statusText: "Unauthorized", headers: {} });
    };
    await expect(api.get("/profile")).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAuthToken()).toBeNull(); expect(sessionStorage.getItem("nouri_user")).toBeNull();
  });

  it("retains the session and original error for non-401 failures", async () => {
    saveAuthSession({ token: "token-a", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    const failure = Object.assign(new AxiosError("Invalid"), { response: { status: 422, data: { message: "Dữ liệu gửi lên chưa hợp lệ." } } });
    api.defaults.adapter = async () => { throw failure; };
    await expect(api.put("/profile", {})).rejects.toBe(failure);
    expect(getApiError(failure)).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(getAuthToken()).toBe("token-a"); expect(location.href).toBe("/profile");
  });

  it("logs out and explains when the account was locked by an Admin (403 ACCOUNT_LOCKED)", async () => {
    saveAuthSession({ token: "token-a", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    api.defaults.adapter = async (config) => {
      const data = { message: "Tài khoản đã bị khóa.", details: { code: "ACCOUNT_LOCKED" } };
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, undefined, { config, data, status: 403, statusText: "Forbidden", headers: {} });
    };
    const failure = await api.get("/pantry").catch((error: unknown) => error);
    expect(isAccountLockedError(failure)).toBe(true);
    expect(getAuthToken()).toBeNull(); expect(location.href).toBe("/login?locked=1");
  });

  it("keeps the session on other 403 errors (e.g. USER calling an Admin API)", async () => {
    saveAuthSession({ token: "token-a", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    api.defaults.adapter = async (config) => {
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, undefined, { config, data: { message: "Không có quyền" }, status: 403, statusText: "Forbidden", headers: {} });
    };
    const failure = await api.get("/admin/stats").catch((error: unknown) => error);
    expect(isAccountLockedError(failure)).toBe(false);
    expect(getAuthToken()).toBe("token-a"); expect(location.href).toBe("/profile");
  });

  it("sends cookies (refresh token) with API calls", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("preserves network/unknown error messages", () => {
    expect(getApiError(new AxiosError("offline"))).toBe("Không thể kết nối máy chủ.");
    expect(getApiError(new Error("unknown"))).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });
});

// GĐ4: access token 15 phút; gặp 401 thì làm mới một lần bằng cookie refresh token rồi gọi lại request.
const user = { id: "a", name: "A", email: "a@nouri.vn" };
const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown = {}) => {
  if (status < 400) return { config, data, status, statusText: "OK", headers: {} };
  throw new AxiosError("Failed", "ERR_BAD_REQUEST", config, undefined, { config, data, status, statusText: "Failed", headers: {} });
};

describe("Automatic refresh when the access token expires (GĐ4)", () => {
  it("refreshes once, stores the new access token in the same store and retries the original request", async () => {
    saveAuthSession({ token: "expired", user }, false);
    const seen: string[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(`${config.url} ${config.headers.get("Authorization") ?? "-"}`);
      if (config.url === "/auth/refresh") return reply(config, 200, { token: "fresh", user: { ...user, name: "A mới" } });
      return config.headers.get("Authorization") === "Bearer fresh" ? reply(config, 200, { ok: true }) : reply(config, 401);
    };
    await expect(api.get("/pantry")).resolves.toMatchObject({ data: { ok: true } });
    expect(seen).toEqual(["/pantry Bearer expired", "/auth/refresh Bearer expired", "/pantry Bearer fresh"]);
    expect(getAuthToken()).toBe("fresh");
    expect(sessionStorage.getItem("nouri_token")).toBe("fresh");
    expect(getStoredUser()?.name).toBe("A mới");
    expect(location.href).toBe("/profile");
  });

  it("shares one refresh between requests that fail together", async () => {
    saveAuthSession({ token: "expired", user });
    let refreshes = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") { refreshes += 1; return reply(config, 200, { token: "fresh", user }); }
      return config.headers.get("Authorization") === "Bearer fresh" ? reply(config, 200, { url: config.url }) : reply(config, 401);
    };
    await Promise.all([api.get("/pantry"), api.get("/profile"), api.get("/meal-plans")]);
    expect(refreshes).toBe(1);
  });

  it("retries the refresh once after REFRESH_RACE (another tab refreshed at the same moment)", async () => {
    saveAuthSession({ token: "expired", user });
    let refreshes = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshes += 1;
        return refreshes === 1 ? reply(config, 401, { details: { code: "REFRESH_RACE" } }) : reply(config, 200, { token: "fresh", user });
      }
      return config.headers.get("Authorization") === "Bearer fresh" ? reply(config, 200) : reply(config, 401);
    };
    await expect(api.get("/pantry")).resolves.toMatchObject({ status: 200 });
    expect(refreshes).toBe(2);
  });

  it("signs out to /login when the refresh token is gone too, without looping", async () => {
    saveAuthSession({ token: "expired", user });
    const calls: string[] = [];
    api.defaults.adapter = async (config) => { calls.push(config.url!); return reply(config, 401); };
    await expect(api.get("/pantry")).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toEqual(["/pantry", "/auth/refresh"]);
    expect(getAuthToken()).toBeNull(); expect(location.href).toBe("/login");
  });

  it("goes to /login?locked=1 when the refresh is refused because the account was locked", async () => {
    saveAuthSession({ token: "expired", user });
    api.defaults.adapter = async (config) => (config.url === "/auth/refresh"
      ? reply(config, 403, { details: { code: "ACCOUNT_LOCKED" } })
      : reply(config, 401));
    await expect(api.get("/pantry")).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAuthToken()).toBeNull(); expect(location.href).toBe("/login?locked=1");
  });

  it("never refreshes for a wrong password at login (401 is the answer, not an expired session)", async () => {
    location.pathname = "/login"; location.href = "/login";
    const calls: string[] = [];
    api.defaults.adapter = async (config) => { calls.push(config.url!); return reply(config, 401); };
    await expect(api.post("/auth/login", {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toEqual(["/auth/login"]);
  });
});
