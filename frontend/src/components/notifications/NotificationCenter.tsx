import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../../api/client";
import {
  notificationActionPath,
  notificationListLimit,
  shouldMarkNotificationRead,
  unreadBadgeLabel,
} from "../../features/notifications/notifications.logic";
import {
  invalidateNotificationQueries,
  notificationMutations,
  notificationQueries,
} from "../../features/notifications/notifications.queries";
import type { AppNotification } from "../../types";
import NotificationList from "./NotificationList";
import type { NotificationFilter } from "../../features/notifications/notifications.api";

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

  const countQuery = useQuery(notificationQueries.unreadCount());

  const notificationsQuery = useQuery({
    ...notificationQueries.list({ filter, limit: notificationListLimit(drawerOpen) }),
    enabled: dropdownOpen || drawerOpen,
  });

  const markRead = useMutation({
    ...notificationMutations.markRead(),
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });

  const markAllRead = useMutation({
    ...notificationMutations.markAllRead(),
    onSuccess: () => invalidateNotificationQueries(queryClient),
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
    if (shouldMarkNotificationRead(notification)) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        // Điều hướng vẫn tiếp tục; lần đồng bộ sau sẽ thử tải lại trạng thái.
      }
    }
    setDropdownOpen(false);
    setDrawerOpen(false);
    const actionPath = notificationActionPath(notification.actionUrl);
    if (actionPath) navigate(actionPath);
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
