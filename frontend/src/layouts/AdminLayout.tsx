import { Suspense } from "react";
import { BookOpen, LayoutDashboard, LogOut, Menu, ScrollText, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button, NouriWordmark, ThemeToggle } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { ADMIN_NAV, userInitial } from "../features/layout/layout.logic";
import { useDisclosure } from "../features/layout/useDisclosure";
import { cx } from "../features/ui/ui.logic";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/recipes": BookOpen,
  "/admin/users": Users,
  "/admin/moderation": ShieldCheck,
  "/admin/audit-logs": ScrollText,
};

/**
 * Khung riêng của khu Quản trị (tách khỏi khung người dùng). ≥ 1024px: menu trái cố định (logo + nhãn "Quản trị", 5 mục,
 * cuối menu: chế độ tối, tài khoản admin, Đăng xuất). < 1024px: thanh trên (logo + nút menu) mở menu dạng ngăn kéo.
 * Mục menu dùng lại kiểu liên kết chữ phẳng của menu người dùng (.site-nav__link); chỉ dùng token.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const drawer = useDisclosure<HTMLDivElement>();

  const brand = (
    <Link to="/admin" className="ad-brand" aria-label="Nouri Quản trị, về trang Tổng quan quản trị">
      <NouriWordmark />
      <span className="ad-brand__tag" aria-hidden="true">Quản trị</span>
    </Link>
  );

  return (
    <div className="ad-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <div className="ad-chrome" ref={drawer.rootRef}>
        <header className="ad-topbar">
          {brand}
          <button type="button" className="ui-icon-button ad-topbar__menu" {...drawer.buttonProps} aria-label="Menu quản trị">
            {drawer.open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </header>

        <aside id={drawer.panelId} className={cx("ad-sidebar", drawer.open && "is-open")} aria-label="Khu quản trị">
          <div className="ad-sidebar__brand">{brand}</div>
          <nav className="ad-nav" aria-label="Mục quản trị">
            <ul>
              {ADMIN_NAV.map(({ to, label, end }) => {
                const Icon = ICONS[to];
                return (
                  <li key={to}>
                    <NavLink to={to} end={end} className={({ isActive }) => cx("site-nav__link", "ad-nav__link", isActive && "is-active")}>
                      <Icon aria-hidden="true" />{label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ad-sidebar__foot">
            <div className="ad-sidebar__theme">
              <span>Chế độ tối</span>
              <ThemeToggle className="ad-sidebar__icon" />
            </div>
            <div className="ad-account">
              <span className="account-menu__avatar" aria-hidden="true">{userInitial(user?.name)}</span>
              <span className="ad-account__who">
                <span className="ad-account__name">{user?.name}</span>
                <span className="ad-account__email">{user?.email}</span>
              </span>
            </div>
            <Button icon={<LogOut />} block onClick={logout}>Đăng xuất</Button>
          </div>
        </aside>
      </div>

      <main id="noi-dung-chinh" tabIndex={-1} className="ad-main">
        <div className="ad-view">
          <h1 className="ui-visually-hidden">Quản trị Nouri</h1>
          <Suspense fallback={null}><Outlet /></Suspense>
        </div>
      </main>
    </div>
  );
}
