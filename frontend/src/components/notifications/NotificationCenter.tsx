import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiError } from "../../api/client";
import type { AppNotification } from "../../types";
import NotificationList from "./NotificationList";
import { unreadBadgeLabel } from "./notification-utils";

type NotificationFilter = "all" | "unread";

const notificationCountKey = ["notifications", "unread-count"] as const;

function NotificationTabs({ filter, onChange }: { filter: NotificationFilter; onChange: (filter: NotificationFilter) => void }) {
  return (
    <div className="notification-tabs" role="tablist" aria-label="Lọc thông báo">
      <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => onChange("all")}>Tất cả</button>
      <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => onChange("unread")}>Chưa đọc</button>
    </div>
  );
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const countQuery = useQuery({
    queryKey: notificationCountKey,
    queryFn: async () => (await api.get<{ count: number }>("/notifications/unread-count")).data,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "list", filter],
    queryFn: async () => (await api.get<AppNotification[]>("/notifications", { params: { filter, limit: drawerOpen ? 200 : 100 } })).data,
    enabled: dropdownOpen || drawerOpen,
    staleTime: 10_000,
  });

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications", "list"] }),
      queryClient.invalidateQueries({ queryKey: notificationCountKey }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.patch<AppNotification>(`/notifications/${id}/read`)).data,
    onSuccess: refreshNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: async () => (await api.patch<{ count: number }>("/notifications/read-all")).data,
    onSuccess: refreshNotifications,
  });

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen && !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dropdownOpen, drawerOpen]);

  useEffect(() => {
    document.body.classList.toggle("notification-drawer-open", drawerOpen);
    return () => document.body.classList.remove("notification-drawer-open");
  }, [drawerOpen]);

  const unreadCount = countQuery.data?.count ?? 0;
  const badgeLabel = unreadBadgeLabel(unreadCount);
  const notifications = notificationsQuery.data ?? [];

  const selectNotification = async (notification: AppNotification) => {
    if (!notification.isRead) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        // Điều hướng vẫn tiếp tục; lần đồng bộ sau sẽ thử tải lại trạng thái.
      }
    }
    setDropdownOpen(false);
    setDrawerOpen(false);
    if (notification.actionUrl?.startsWith("/")) navigate(notification.actionUrl);
  };

  const openDrawer = () => {
    setDropdownOpen(false);
    setDrawerOpen(true);
  };

  const listProps = {
    notifications,
    isLoading: notificationsQuery.isLoading,
    error: notificationsQuery.isError ? getApiError(notificationsQuery.error) : undefined,
    onRetry: () => void notificationsQuery.refetch(),
    onSelect: (notification: AppNotification) => void selectNotification(notification),
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell${dropdownOpen ? " active" : ""}`}
        aria-label="Thông báo"
        aria-expanded={dropdownOpen}
        title="Thông báo"
        onClick={() => {
          setDrawerOpen(false);
          setDropdownOpen((open) => !open);
        }}
      >
        <Bell />
        {badgeLabel && <span className="notification-badge">{badgeLabel}</span>}
      </button>

      {dropdownOpen && (
        <section className="notification-dropdown" aria-label="Danh sách thông báo">
          <header className="notification-panel-header">
            <h2>Thông báo</h2>
            <button type="button" disabled={!unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck /> Đánh dấu đã đọc
            </button>
          </header>
          <NotificationTabs filter={filter} onChange={setFilter} />
          <div className="notification-dropdown-scroll"><NotificationList {...listProps} /></div>
          <button type="button" className="notification-view-all" onClick={openDrawer}>Xem tất cả thông báo <span>→</span></button>
        </section>
      )}

      {drawerOpen && (
        <div className="notification-drawer-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}>
          <aside className="notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-drawer-title">
            <header className="notification-drawer-header">
              <div><span><Bell /></span><h2 id="notification-drawer-title">Thông báo</h2></div>
              <button type="button" aria-label="Đóng thông báo" onClick={() => setDrawerOpen(false)}><X /></button>
            </header>
            <div className="notification-drawer-toolbar">
              <NotificationTabs filter={filter} onChange={setFilter} />
              <button type="button" disabled={!unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}><CheckCheck /> Đánh dấu tất cả đã đọc</button>
            </div>
            <div className="notification-drawer-scroll"><NotificationList {...listProps} /></div>
          </aside>
        </div>
      )}
    </div>
  );
}
