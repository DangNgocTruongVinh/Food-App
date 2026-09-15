import { type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { login, register } from "./auth.api";
import { acceptAuthSession, endAuthSession, updateAuthUser } from "./auth.session";
import { clearAuthSession, getAuthToken, getStoredUser, saveAuthSession } from "./auth.storage";

const session = { token: "existing-v1-token", user: { id: "user-a", name: "Minh Anh", email: "demo@nouri.vn" } };
const originalAdapter = api.defaults.adapter;
let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  });
});
afterEach(() => { api.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

describe("V1 auth storage", () => {
  it("starts with an empty session", () => {
    expect(getAuthToken()).toBeNull(); expect(getStoredUser()).toBeNull();
  });
  it("reads sessions already stored by V1 without renaming keys", () => {
    stored.set("nutriplan_token", session.token);
    stored.set("nutriplan_user", JSON.stringify(session.user));
    expect(getAuthToken()).toBe(session.token); expect(getStoredUser()).toEqual(session.user);
  });
  it("persists precisely the token and public user returned by the API", () => {
    saveAuthSession(session);
    expect(Object.fromEntries(stored)).toEqual({ nutriplan_token: session.token, nutriplan_user: JSON.stringify(session.user) });
  });
  it("clears only auth keys and is safe to repeat", () => {
    stored.set("unrelated", "keep"); saveAuthSession(session);
    clearAuthSession(); clearAuthSession();
    expect(Object.fromEntries(stored)).toEqual({ unrelated: "keep" });
  });
  it("clears a corrupt stored session without throwing", () => {
    stored.set("nutriplan_token", session.token);
    stored.set("nutriplan_user", "bad-json");
    expect(getStoredUser()).toBeNull();
    expect(Object.fromEntries(stored)).toEqual({});
  });
  it.each(["null", "{}", JSON.stringify({ id: "user-a", name: 123, email: "demo@nouri.vn" })])("clears invalid user JSON shape %s", (value) => {
    stored.set("nutriplan_token", session.token);
    stored.set("nutriplan_user", value);
    expect(getStoredUser()).toBeNull();
    expect(Object.fromEntries(stored)).toEqual({});
  });
});

describe("Auth session and query cache", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createAppQueryClient();
    queryClient.setQueryData(["profile"], { id: "old-user" });
    queryClient.setQueryData(["pantry"], [{ id: "old-item" }]);
  });
  afterEach(() => queryClient.clear());

  it("clears all cached user data before accepting a login or account change", () => {
    expect(acceptAuthSession(queryClient, session)).toEqual(session.user);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(getAuthToken()).toBe(session.token);
    expect(getStoredUser()).toEqual(session.user);
  });
  it("clears cache and persisted auth data on logout", () => {
    saveAuthSession(session);
    endAuthSession(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
  it("updates the stored public user without replacing the token", () => {
    saveAuthSession(session);
    const updatedUser = { ...session.user, name: "Tên mới" };
    expect(updateAuthUser(updatedUser)).toEqual(updatedUser);
    expect(getAuthToken()).toBe(session.token);
    expect(getStoredUser()).toEqual(updatedUser);
  });
});

describe("Auth API adapters (no network)", () => {
  it.each([
    ["login", "/auth/login", { email: "Demo@Nouri.vn", password: "Demo@123" }],
    ["register", "/auth/register", { name: "  Minh Anh  ", email: "Demo@Nouri.vn", password: "Demo@123" }],
  ] as const)("preserves %s payload and unwraps the existing response", async (operation, path, input) => {
    const adapter = vi.fn(async (config) => ({ config, data: session, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    const result = operation === "register" ? await register(input as { name: string; email: string; password: string }) : await login(input);
    expect(result).toEqual(session);
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe(path); expect(config.method).toBe("post");
    expect(JSON.parse(config.data)).toEqual(input);
    expect(getAuthToken()).toBeNull(); // Persistence remains AuthContext's responsibility.
  });
  it("propagates failed requests without accepting a session", async () => {
    const failure = new Error("offline");
    api.defaults.adapter = async () => { throw failure; };
    await expect(login({ email: session.user.email, password: "Demo@123" })).rejects.toBe(failure);
    expect(getStoredUser()).toBeNull();
  });
});
