import type { AdminStats } from "./admin.api";

export const STATS_SERIES = [
  { key: "users", label: "Người dùng mới" },
  { key: "mealPlans", label: "Thực đơn mới" },
  { key: "posts", label: "Bài viết mới" },
] as const;

/** Nhãn trục tuần: ngày thứ Hai đầu tuần "dd/MM" (backend trả yyyy-MM-dd theo giờ Việt Nam). */
export function weekLabel(weekStart: string) {
  const [, month, day] = weekStart.split("-");
  return `${day}/${month}`;
}

const number = (value: number) => value.toLocaleString("vi-VN");

/** 4 số tổng kèm chú thích thật. */
export function statsCards(totals: AdminStats["totals"]) {
  return [
    { key: "users", label: "Người dùng", value: number(totals.users), note: totals.lockedUsers ? `Trong đó ${number(totals.lockedUsers)} bị khóa` : "Không ai bị khóa" },
    { key: "mealPlans", label: "Thực đơn", value: number(totals.mealPlans), note: "Mọi trạng thái: nháp, đang áp dụng, đã xong" },
    { key: "posts", label: "Bài viết", value: number(totals.posts), note: "Trong cộng đồng" },
    { key: "recipes", label: "Công thức", value: number(totals.recipes), note: totals.hiddenRecipes ? `Trong đó ${number(totals.hiddenRecipes)} đang ẩn` : "Tất cả đang hiện" },
  ];
}

export const hasWeeklyActivity = (weekly: AdminStats["weekly"]) => weekly.some((row) => row.users + row.mealPlans + row.posts > 0);
