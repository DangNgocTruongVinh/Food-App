import { type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { login, register } from "./auth.api";
import { acceptAuthSession, endAuthSession, updateAuthUser } from "./auth.session";
import {
  clearAuthSession, getAuthToken, getRememberLoginPreference, getStoredUser, isSessionRemembered, saveAuthSession,
  saveRememberLoginPreference,
} from "./auth.storage";

const session = { token: "existing-v1-token", user: { id: "user-a", name: "Minh Anh", email: "demo@nouri.vn" } };
const originalAdapter = api.defaults.adapter;
let stored: Map<string, string>;
let tabStored: Map<string, string>;
function stubStorage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}
beforeEach(() => {
  stored = new Map();
  tabStored = new Map();
  vi.stubGlobal("localStorage", stubStorage(stored));
  vi.stubGlobal("sessionStorage", stubStorage(tabStored));
});
afterEach(() => { api.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

describe("V1 auth storage", () => {
  it("starts with an empty session", () => {
    expect(getAuthToken()).toBeNull(); expect(getStoredUser()).toBeNull();
  });
  it("reads sessions already stored by V1 without renaming keys", () => {
    stored.set("nouri_token", session.token);
    stored.set("nouri_user", JSON.stringify(session.user));
    expect(getAuthToken()).toBe(session.token); expect(getStoredUser()).toEqual(session.user);
  });
  it("persists precisely the token and public user returned by the API", () => {
    saveAuthSession(session);
    expect(Object.fromEntries(stored)).toEqual({ nouri_token: session.token, nouri_user: JSON.stringify(session.user) });
  });
  it("clears only auth keys and is safe to repeat", () => {
    stored.set("unrelated", "keep"); saveAuthSession(session);
    clearAuthSession(); clearAuthSession();
    expect(Object.fromEntries(stored)).toEqual({ unrelated: "keep" });
  });
  it("keeps a non-remembered session only in sessionStorage", () => {
    saveAuthSession(session, false);
    expect(Object.fromEntries(stored)).toEqual({});
    expect(Object.fromEntries(tabStored)).toEqual({ nouri_token: session.token, nouri_user: JSON.stringify(session.user) });
    expect(getAuthToken()).toBe(session.token); expect(getStoredUser()).toEqual(session.user);
    expect(isSessionRemembered()).toBe(false);
  });
  it.each([true, false])("removes the session left in the other storage when saving (remember=%s)", (remember) => {
    saveAuthSession({ ...session, token: "old-token" }, !remember);
    saveAuthSession(session, remember);
    expect(Object.fromEntries(remember ? tabStored : stored)).toEqual({});
    expect(getAuthToken()).toBe(session.token);
    expect(isSessionRemembered()).toBe(remember);
  });
  it("clears the session from both storages", () => {
    stored.set("nouri_token", "a"); tabStored.set("nouri_token", "b");
    tabStored.set("nouri_user", JSON.stringify(session.user));
    clearAuthSession();
    expect(Object.fromEntries(stored)).toEqual({}); expect(Object.fromEntries(tabStored)).toEqual({});
  });
  it("defaults the remember-login checkbox to checked before any choice", () => {
    expect(getRememberLoginPreference()).toBe(true);
  });
  it.each([true, false])("remembers the last remember-login choice (%s) without storing a token", (remember) => {
    saveRememberLoginPreference(remember);
    expect(getRememberLoginPreference()).toBe(remember);
    expect(getAuthToken()).toBeNull();
  });
  it("keeps the remember-login choice after logout", () => {
    saveRememberLoginPreference(false); saveAuthSession(session, false);
    clearAuthSession();
    expect(getRememberLoginPreference()).toBe(false);
  });
  it.each([
    ["remembered", () => stored, () => tabStored],
    ["not remembered", () => tabStored, () => stored],
  ] as const)("moves a %s session stored under the old nutriplan_* keys to the new keys without logging out", (_label, own, other) => {
    own().set("nutriplan_token", session.token);
    own().set("nutriplan_user", JSON.stringify(session.user));
    expect(getAuthToken()).toBe(session.token);
    expect(getStoredUser()).toEqual(session.user);
    expect(Object.fromEntries(own())).toEqual({ nouri_token: session.token, nouri_user: JSON.stringify(session.user) });
    expect(other().size).toBe(0);
  });
  it("moves the old remember-login choice and never overwrites a newer value", () => {
    stored.set("nutriplan_remember_login", "false");
    expect(getRememberLoginPreference()).toBe(false);
    expect(stored.has("nutriplan_remember_login")).toBe(false);
    stored.set("nouri_token", "new-token"); stored.set("nutriplan_token", "old-token");
    expect(getAuthToken()).toBe("new-token");
    expect(stored.has("nutriplan_token")).toBe(false);
  });
  it("clears a corrupt stored session without throwing", () => {
    stored.set("nouri_token", session.token);
    stored.set("nouri_user", "bad-json");
    expect(getStoredUser()).toBeNull();
    expect(Object.fromEntries(stored)).toEqual({});
  });
  it.each(["null", "{}", JSON.stringify({ id: "user-a", name: 123, email: "demo@nouri.vn" })])("clears invalid user JSON shape %s", (value) => {
    stored.set("nouri_token", session.token);
    stored.set("nouri_user", value);
    expect(getStoredUser()).toBeNull();
    expect(Object.fromEntries(stored)).toEqual({});
  });
});

describe("Auth storage when the browser blocks or rejects storage", () => {
  const blockStorage = (name: "localStorage" | "sessionStorage") =>
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("SecurityError: storage blocked"); } });
  const throwingStorage = (map: Map<string, string>, failing: "setItem" | "removeItem") => ({
    ...stubStorage(map),
    [failing]: () => { throw new Error(failing === "setItem" ? "QuotaExceededError" : "SecurityError"); },
  });
  afterEach(() => clearAuthSession());

  it("does not crash when accessing localStorage/sessionStorage throws, and starts logged out with the default preference", () => {
    blockStorage("localStorage");
    blockStorage("sessionStorage");
    expect(getRememberLoginPreference()).toBe(true);
    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(() => { saveRememberLoginPreference(false); clearAuthSession(); }).not.toThrow();
  });

  it("keeps the session in memory for this tab when nothing can be stored", () => {
    blockStorage("localStorage");
    blockStorage("sessionStorage");
    saveAuthSession(session);
    expect(getAuthToken()).toBe(session.token);
    expect(getStoredUser()).toEqual(session.user);
    updateAuthUser({ ...session.user, name: "Minh Anh mới" });
    expect(getStoredUser()?.name).toBe("Minh Anh mới");
    clearAuthSession();
    expect(getAuthToken()).toBeNull();
  });

  it("falls back to memory when writing is rejected (quota) and leaves no half-written session", () => {
    vi.stubGlobal("localStorage", throwingStorage(stored, "setItem"));
    saveAuthSession(session, true);
    expect(Object.fromEntries(stored)).toEqual({});
    expect(getAuthToken()).toBe(session.token);
  });

  it("does not crash when removing old nutriplan_* keys fails", () => {
    stored.set("nutriplan_token", session.token);
    vi.stubGlobal("localStorage", throwingStorage(stored, "removeItem"));
    expect(() => getAuthToken()).not.toThrow();
    expect(getAuthToken()).toBe(session.token);
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
  it("stores the session in sessionStorage when login is not remembered", () => {
    acceptAuthSession(queryClient, session, false);
    expect(tabStored.get("nouri_token")).toBe(session.token);
    expect(stored.size).toBe(0);
  });
  it("updates the user in the storage that holds a non-remembered session", () => {
    saveAuthSession(session, false);
    const updatedUser = { ...session.user, name: "Tên mới" };
    updateAuthUser(updatedUser);
    expect(stored.size).toBe(0);
    expect(getStoredUser()).toEqual(updatedUser);
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
