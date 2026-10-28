import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { CommunityPost } from "../../types";

export const suggestedTopics = [
  { label: "Bữa ăn hôm nay", count: 128 },
  { label: "Mẹo bảo quản", count: 86 },
  { label: "Công thức lành mạnh", count: 256 },
  { label: "Hành trình của tôi", count: 112 },
];

export const featuredMembers = [
  { name: "Linh Nhi", role: "Chuyên gia dinh dưỡng" },
  { name: "Minh An", role: "Thành viên tích cực" },
];

export function communityInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
}

export function communityRelativeTime(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: vi });
}

export function normalizeCommunityContent(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export function toggleCommunitySelection(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface CommunityShareTarget {
  share?: (data?: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export async function shareCommunityPost(
  post: CommunityPost,
  target: CommunityShareTarget = navigator,
) {
  try {
    if (target.share) {
      await target.share({ title: `Bài viết của ${post.author.name}`, text: post.content });
    } else {
      await target.clipboard?.writeText(post.content);
    }
  } catch {
    // Người dùng có thể đóng hộp thoại chia sẻ mà không thực hiện hành động.
  }
}
