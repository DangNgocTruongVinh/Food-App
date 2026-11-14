// Logic thuần của khung ứng dụng (menu trên, menu tài khoản, footer) — docs/design/DESIGN.md mục 13.

export type NavLinkItem = { to: string; label: string; end?: boolean };

/** Liên kết chính trên menu (Hồ sơ nằm trong menu tài khoản). */
// 7 mục phải vừa một hàng từ 1201px (dưới đó dùng menu gọn) kể cả khi tên tài khoản dài: nhãn ngắn "Kho" (tiêu đề trang vẫn đầy đủ).
export const PRIMARY_NAV: NavLinkItem[] = [
  { to: "/dashboard", label: "Tổng quan", end: true },
  { to: "/pantry", label: "Kho" },
  { to: "/meal-plans", label: "Thực đơn" },
  { to: "/recipes", label: "Công thức" },
  { to: "/community", label: "Cộng đồng" },
  { to: "/assistant", label: "Trợ lý AI" },
  { to: "/reports", label: "Báo cáo" },
];

/** Menu trái của khu Quản trị (AdminLayout); mỗi mục một route con của /admin. */
export const ADMIN_NAV: NavLinkItem[] = [
  { to: "/admin", label: "Tổng quan", end: true },
  { to: "/admin/recipes", label: "Công thức" },
  { to: "/admin/users", label: "Người dùng" },
  { to: "/admin/moderation", label: "Kiểm duyệt" },
  { to: "/admin/catalog", label: "Danh mục dữ liệu" },
  { to: "/admin/audit-logs", label: "Nhật ký" },
];

export type AccountMenuItem = { kind: "link"; to: string; label: string } | { kind: "logout"; label: string };

export function isAdmin(user: { role?: string } | null | undefined) {
  return user?.role === "ADMIN";
}

/** Trang xem trước công thức (/recipes/:id): trang người dùng duy nhất ADMIN được mở (có nút "Về trang quản trị"). */
export function isRecipePreviewPath(pathname: string) {
  return /^\/recipes\/[^/]+\/?$/.test(pathname);
}

/**
 * Khu Admin tách riêng: ADMIN mở một trang người dùng thì chuyển về "/admin", trừ xem trước công thức.
 * null: giữ nguyên (USER, chưa đăng nhập, hoặc ADMIN đang xem trước công thức).
 */
export function adminRedirect(user: { role?: string } | null | undefined, pathname: string): string | null {
  if (!isAdmin(user)) return null;
  return isRecipePreviewPath(pathname) ? null : "/admin";
}

/**
 * Trang mở sau khi đăng nhập/đăng ký. `next` đã qua safeNextPath. ADMIN vào thẳng "/admin" (giữ next nếu là trang Admin
 * hoặc xem trước công thức); USER giữ next, trừ trang Admin (không có quyền) thì về Tổng quan.
 */
export function postLoginPath(user: { role?: string } | null | undefined, next: string): string {
  const isAdminPath = next === "/admin" || next.startsWith("/admin/");
  if (isAdmin(user)) return isAdminPath || isRecipePreviewPath(next) ? next : "/admin";
  return isAdminPath ? "/dashboard" : next;
}

/** Hồ sơ, Quản trị (chỉ ADMIN), Đăng xuất. */
export function accountMenuItems(user: { role?: string } | null | undefined): AccountMenuItem[] {
  return [
    { kind: "link", to: "/profile", label: "Hồ sơ" },
    // Admin dùng khu /admin riêng nên không có danh sách cá nhân.
    ...(isAdmin(user) ? [{ kind: "link", to: "/admin", label: "Quản trị" } as const] : [{ kind: "link", to: "/recipes/favorites", label: "Món yêu thích" } as const]),
    { kind: "logout", label: "Đăng xuất" },
  ];
}

/** Chữ cái đầu của tên (ảnh đại diện chữ); tên trống → "N". */
export function userInitial(name: string | null | undefined) {
  const first = name?.trim().charAt(0);
  return first ? first.toLocaleUpperCase("vi") : "N";
}

/** Nhóm liên kết footer: chỉ trang có thật. */
export const FOOTER_GROUPS: { title: string; links: NavLinkItem[] }[] = [
  {
    title: "Bếp của bạn",
    links: [
      { to: "/dashboard", label: "Tổng quan" },
      { to: "/pantry", label: "Kho thực phẩm" },
      { to: "/meal-plans", label: "Thực đơn" },
      { to: "/recipes", label: "Công thức" },
      { to: "/reports", label: "Báo cáo" },
    ],
  },
  {
    title: "Cùng nấu",
    links: [
      { to: "/community", label: "Cộng đồng" },
      { to: "/assistant", label: "Trợ lý AI" },
      { to: "/profile", label: "Hồ sơ" },
    ],
  },
  {
    title: "Thông tin",
    links: [
      { to: "/privacy", label: "Chính sách bảo mật" },
      { to: "/terms", label: "Điều khoản sử dụng" },
    ],
  },
];
