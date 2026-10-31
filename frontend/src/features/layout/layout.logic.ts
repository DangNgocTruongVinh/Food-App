// Logic thuần của khung ứng dụng (menu trên, menu tài khoản, footer) — docs/design/DESIGN.md mục 13.

export type NavLinkItem = { to: string; label: string; end?: boolean };

/** Liên kết chính trên menu (Hồ sơ nằm trong menu tài khoản). */
export const PRIMARY_NAV: NavLinkItem[] = [
  { to: "/dashboard", label: "Tổng quan", end: true },
  { to: "/pantry", label: "Kho thực phẩm" },
  { to: "/meal-plans", label: "Thực đơn" },
  { to: "/recipes", label: "Công thức" },
  { to: "/community", label: "Cộng đồng" },
  { to: "/assistant", label: "Trợ lý AI" },
];

export type AccountMenuItem = { kind: "link"; to: string; label: string } | { kind: "logout"; label: string };

export function isAdmin(user: { role?: string } | null | undefined) {
  return user?.role === "ADMIN";
}

/** Hồ sơ, Quản trị (chỉ ADMIN), Đăng xuất. */
export function accountMenuItems(user: { role?: string } | null | undefined): AccountMenuItem[] {
  return [
    { kind: "link", to: "/profile", label: "Hồ sơ" },
    ...(isAdmin(user) ? [{ kind: "link", to: "/admin", label: "Quản trị" } as const] : []),
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

/**
 * Trang đã làm lại theo giao diện mới (nội dung đổi theo chế độ sáng/tối). Trang chưa làm lại dùng CSS cũ với chữ tối
 * đặt thẳng trên nền nên vùng nội dung luôn ở chế độ sáng; mỗi lượt UI thêm trang của lượt đó vào danh sách này.
 */
export const REDESIGNED_ROUTES = ["/admin"];

export function isRedesignedRoute(pathname: string) {
  return REDESIGNED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
