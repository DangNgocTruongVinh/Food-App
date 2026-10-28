import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getApiError } from "./client";
import { getAuthToken, saveAuthSession } from "../features/auth/auth.storage";

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
    expect(getAuthToken()).toBeNull(); expect(localStorage.getItem("nutriplan_user")).toBeNull();
    expect(location.href).toBe(path.startsWith("/login") ? path : "/login");
  });

  it("attaches and clears a non-remembered session on 401", async () => {
    saveAuthSession({ token: "tab-token", user: { id: "a", name: "A", email: "a@nouri.vn" } }, false);
    api.defaults.adapter = async (config) => {
      expect(config.headers.get("Authorization")).toBe("Bearer tab-token");
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, status: 401, statusText: "Unauthorized", headers: {} });
    };
    await expect(api.get("/profile")).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAuthToken()).toBeNull(); expect(sessionStorage.getItem("nutriplan_user")).toBeNull();
  });

  it("retains the session and original error for non-401 failures", async () => {
    saveAuthSession({ token: "token-a", user: { id: "a", name: "A", email: "a@nouri.vn" } });
    const failure = Object.assign(new AxiosError("Invalid"), { response: { status: 422, data: { message: "Dữ liệu gửi lên chưa hợp lệ." } } });
    api.defaults.adapter = async () => { throw failure; };
    await expect(api.put("/profile", {})).rejects.toBe(failure);
    expect(getApiError(failure)).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(getAuthToken()).toBe("token-a"); expect(location.href).toBe("/profile");
  });

  it("preserves network/unknown error messages", () => {
    expect(getApiError(new AxiosError("offline"))).toBe("Không thể kết nối máy chủ.");
    expect(getApiError(new Error("unknown"))).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });
});
