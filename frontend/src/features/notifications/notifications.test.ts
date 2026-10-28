import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { AppNotification, NotificationType } from "../../types";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.api";
import {
  groupNotifications,
  notificationActionPath,
  notificationListLimit,
  notificationRelativeTime,
  notificationTone,
  shouldMarkNotificationRead,
  unreadBadgeLabel,
} from "./notifications.logic";
import {
  invalidateNotificationQueries,
  notificationMutations,
  notificationQueries,
} from "./notifications.queries";

const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: "notification-a",
  userId: "user-a",
  type: "PANTRY_EXPIRING",
  title: "Thực phẩm sắp hết hạn",
  message: "Ức gà sẽ hết hạn sau 2 ngày.",
  isRead: false,
  relatedId: "pantry-a",
  actionUrl: "/pantry?item=pantry-a",
  createdAt: "2026-09-15T08:00:00.000+07:00",
  ...overrides,
});

const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
});

afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Notifications API adapters (no network)", () => {
  it("lists notifications with the existing filter and limit parameters", async () => {
    const data = [notification()];
    const adapter = vi.fn(async (config) => ({
      config, data, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(listNotifications({ filter: "unread", limit: 200 })).resolves.toEqual(data);
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: "get",
      url: "/notifications",
      params: { filter: "unread", limit: 200 },
    });
  });

  it("loads unread count through the unchanged endpoint", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: { count: 4 }, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(getUnreadNotificationCount()).resolves.toEqual({ count: 4 });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/notifications/unread-count" });
  });

  it("marks one notification through the unchanged endpoint", async () => {
    const read = notification({ isRead: true });
    const adapter = vi.fn(async (config) => ({
      config, data: read, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(markNotificationRead(read.id)).resolves.toEqual(read);
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: "patch", url: `/notifications/${read.id}/read`,
    });
  });

  it("marks all notifications through the unchanged endpoint", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: { count: 3 }, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await expect(markAllNotificationsRead()).resolves.toEqual({ count: 3 });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "patch", url: "/notifications/read-all" });
  });

  it.each(["list", "count", "read", "read-all"] as const)("propagates a failed %s request", async (operation) => {
    const failure = new Error(`${operation} failed`);
    api.defaults.adapter = async () => { throw failure; };
    const requests = {
      list: () => listNotifications({ filter: "all", limit: 100 }),
      count: () => getUnreadNotificationCount(),
      read: () => markNotificationRead("notification-a"),
      "read-all": () => markAllNotificationsRead(),
    };
    await expect(requests[operation]()).rejects.toBe(failure);
  });
});

describe("Notifications query definitions and invalidation", () => {
  it("uses parameter-aware list keys and retains polling settings", () => {
    expect(queryKeys.notifications.all).toEqual(["notifications"]);
    expect(notificationQueries.list({ filter: "all", limit: 100 }).queryKey)
      .toEqual(["notifications", "list", { filter: "all", limit: 100 }]);
    expect(notificationQueries.list({ filter: "unread", limit: 200 }).queryKey)
      .toEqual(["notifications", "list", { filter: "unread", limit: 200 }]);
    expect(notificationQueries.unreadCount()).toMatchObject({
      queryKey: ["notifications", "unread-count"],
      staleTime: 15_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    });
  });

  it("caches equivalent list queries", async () => {
    const data = [notification()];
    const adapter = vi.fn(async (config) => ({
      config, data, status: 200, statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    const params = { filter: "all", limit: 100 } as const;
    await expect(client.fetchQuery(notificationQueries.list(params))).resolves.toEqual(data);
    await expect(client.fetchQuery(notificationQueries.list({ ...params }))).resolves.toEqual(data);
    expect(adapter).toHaveBeenCalledOnce();
  });

  it("invalidates every list variant and unread count without touching other modules", async () => {
    const allKey = queryKeys.notifications.list({ filter: "all", limit: 100 });
    const unreadKey = queryKeys.notifications.list({ filter: "unread", limit: 200 });
    client.setQueryData(allKey, []);
    client.setQueryData(unreadKey, []);
    client.setQueryData(queryKeys.notifications.unreadCount, { count: 2 });
    client.setQueryData(queryKeys.community.feed(), []);
    await invalidateNotificationQueries(client);
    expect(client.getQueryState(allKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(unreadKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.notifications.unreadCount)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.community.feed())?.isInvalidated).toBe(false);
  });

  it("keeps both existing mark-read mutation contracts", () => {
    expect(notificationMutations.markRead().mutationFn).toBe(markNotificationRead);
    expect(notificationMutations.markAllRead().mutationFn).toBe(markAllNotificationsRead);
  });
});

describe("Notifications presentation business logic", () => {
  it("groups notifications into today, yesterday and earlier without reordering them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000+07:00"));
    const today = notification({ id: "today", createdAt: "2026-09-15T08:00:00.000+07:00" });
    const yesterday = notification({ id: "yesterday", createdAt: "2026-09-14T08:00:00.000+07:00" });
    const earlier = notification({ id: "earlier", createdAt: "2026-09-10T08:00:00.000+07:00" });
    expect(groupNotifications([today, yesterday, earlier])).toEqual([
      { label: "Hôm nay", items: [today] },
      { label: "Hôm qua", items: [yesterday] },
      { label: "Trước đó", items: [earlier] },
    ]);
  });

  it("omits empty date groups", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000+07:00"));
    const today = notification({ createdAt: "2026-09-15T08:00:00.000+07:00" });
    expect(groupNotifications([today])).toEqual([{ label: "Hôm nay", items: [today] }]);
  });

  it("keeps unread badge display and cap behavior", () => {
    expect(unreadBadgeLabel(0)).toBeNull();
    expect(unreadBadgeLabel(-1)).toBeNull();
    expect(unreadBadgeLabel(1)).toBe("1");
    expect(unreadBadgeLabel(9)).toBe("9");
    expect(unreadBadgeLabel(10)).toBe("9+");
  });

  it.each([
    ["PANTRY_EXPIRED", "pantry"],
    ["COMMUNITY_LIKE", "community"],
    ["AI_RECIPE_SUGGESTION", "ai"],
    ["MEAL_REMINDER", "meal"],
  ] as [NotificationType, string][])('maps %s to the existing "%s" tone', (type, tone) => {
    expect(notificationTone(type)).toBe(tone);
  });

  it("keeps Vietnamese relative time formatting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
    expect(notificationRelativeTime("2026-09-15T08:00:00.000Z")).toContain("trước");
  });

  it("keeps dropdown/drawer limits and safe internal navigation", () => {
    expect(notificationListLimit(false)).toBe(100);
    expect(notificationListLimit(true)).toBe(200);
    expect(notificationActionPath("/community?post=post-a")).toBe("/community?post=post-a");
    expect(notificationActionPath("https://example.com")).toBeNull();
    expect(notificationActionPath(null)).toBeNull();
  });

  it("marks only unread notifications before selection", () => {
    expect(shouldMarkNotificationRead(notification())).toBe(true);
    expect(shouldMarkNotificationRead(notification({ isRead: true }))).toBe(false);
  });
});
