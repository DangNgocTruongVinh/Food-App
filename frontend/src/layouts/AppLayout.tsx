import { ArrowRight, Bot, CalendarDays, CookingPot, LayoutDashboard, LogOut, PackageOpen, Sparkles, UserRound, UsersRound } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import NotificationCenter from "../components/notifications/NotificationCenter";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/pantry", label: "Kho thực phẩm", icon: PackageOpen },
  { to: "/meal-plans", label: "Thực đơn", icon: CalendarDays },
  { to: "/recipes", label: "Công thức", icon: CookingPot },
  { to: "/community", label: "Cộng đồng", icon: UsersRound },
  { to: "/assistant", label: "Trợ lý AI", icon: Bot },
  { to: "/profile", label: "Hồ sơ", icon: UserRound },
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
  return <div className="app-shell">
    <aside className="sidebar sidebar-route-theme sidebar-theme-overview">
      <Logo />
      <p className="sidebar-tagline">Ăn ngon hơn. Sống khỏe hơn.</p>
      <nav aria-label="Điều hướng chính"><span className="nav-label">Không gian của bạn</span>{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <Link to="/assistant" className="sidebar-tip"><span className="tip-icon"><Sparkles size={14} /></span><div><b>NOURI AI</b><span>Gợi ý món ăn phù hợp từ chính kho thực phẩm của bạn.</span><em>Hỏi AI ngay <ArrowRight size={12} /></em></div></Link>
      <div className="sidebar-user"><Link to="/profile" className="avatar" aria-label="Mở hồ sơ">{user?.name?.charAt(0).toUpperCase()}</Link><div><strong>{user?.name}</strong><small>{user?.email}</small></div><button onClick={logout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>
    <main className={`main-content main-theme-${pageTheme} app-overview-palette`}>
      <header className="desktop-app-tools">
        <NotificationCenter />
        <Link to="/profile" className="desktop-profile-avatar" aria-label="Mở hồ sơ">{user?.name?.charAt(0).toUpperCase()}</Link>
      </header>
      <header className="mobile-header">
        <Logo />
        <div className="mobile-header-actions"><NotificationCenter /><Link to="/profile" className="mobile-avatar" aria-label="Mở hồ sơ">{user?.name?.charAt(0).toUpperCase()}</Link></div>
      </header>
      <Outlet />
    </main>
    <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">{links.slice(0, 6).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
  </div>;
}
