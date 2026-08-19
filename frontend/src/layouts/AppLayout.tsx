import { LogOut } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import NotificationCenter from "../components/notifications/NotificationCenter";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/pantry", label: "Kho thực phẩm" },
  { to: "/meal-plans", label: "Thực đơn" },
  { to: "/recipes", label: "Công thức" },
  { to: "/community", label: "Cộng đồng" },
  { to: "/assistant", label: "Trợ lý AI" },
  { to: "/profile", label: "Hồ sơ" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const pageTheme = pathname.startsWith("/pantry") ? "pantry"
    : pathname.startsWith("/meal-plans") ? "menu"
      : pathname.startsWith("/recipes") ? "recipes"
        : pathname.startsWith("/assistant") ? "assistant"
          : pathname.startsWith("/profile") ? "profile"
            : "overview";

  return (
    <div className="app-shell topbar-layout">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link to="/" className="topbar-brand" aria-label="Về trang tổng quan"><Logo /></Link>

          <nav className="topbar-nav" aria-label="Điều hướng chính">
            {links.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="topbar-actions">
            <NotificationCenter />
            <Link to="/profile" className="topbar-profile" aria-label="Mở hồ sơ">
              <span className="topbar-avatar">{user?.name?.charAt(0).toUpperCase()}</span>
              <span className="topbar-profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span>
            </Link>
            <button className="topbar-logout" type="button" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut /></button>
          </div>
        </div>
      </header>

      <main className={`main-content main-theme-${pageTheme} app-overview-palette`}><Outlet /></main>
    </div>
  );
}
