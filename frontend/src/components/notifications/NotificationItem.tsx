import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  ChefHat,
  Heart,
  MessageCircle,
  PackageMinus,
  PackageX,
  Reply,
  Salad,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification, NotificationType } from "../../types";

const iconByType: Record<NotificationType, LucideIcon> = {
  PANTRY_EXPIRING: AlertTriangle,
  PANTRY_EXPIRED: PackageX,
  PANTRY_LOW_STOCK: PackageMinus,
  MEAL_REMINDER: Salad,
  MEAL_PLAN_CREATED: CalendarCheck,
  MEAL_PREP_REMINDER: ChefHat,
  COMMUNITY_LIKE: Heart,
  COMMUNITY_COMMENT: MessageCircle,
  COMMUNITY_REPLY: Reply,
  COMMUNITY_FOLLOW: UserPlus,
  AI_RECIPE_SUGGESTION: Sparkles,
  AI_EXPIRY_SUGGESTION: Bot,
  AI_NUTRITION_SUGGESTION: Bot,
};

function notificationTone(type: NotificationType) {
  if (type.startsWith("PANTRY_")) return "pantry";
  if (type.startsWith("COMMUNITY_")) return "community";
  if (type.startsWith("AI_")) return "ai";
  return "meal";
}

export default function NotificationItem({
  notification,
  onSelect,
}: {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
}) {
  const Icon = iconByType[notification.type];
  const time = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi });

  return (
    <button
      type="button"
      className={`notification-item${notification.isRead ? "" : " unread"}`}
      onClick={() => onSelect(notification)}
    >
      <span className={`notification-type-icon ${notificationTone(notification.type)}`} aria-hidden="true"><Icon /></span>
      <span className="notification-item-copy">
        <strong>{notification.title}</strong>
        <span>{notification.message}</span>
        <time dateTime={notification.createdAt}>{time}</time>
      </span>
      {!notification.isRead && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
    </button>
  );
}
