import { Bot, CalendarDays, CookingPot, LayoutDashboard, LogOut, PackageOpen, UserRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/pantry", label: "Kho thực phẩm", icon: PackageOpen },
  { to: "/meal-plans", label: "Thực đơn", icon: CalendarDays },
  { to: "/recipes", label: "Công thức", icon: CookingPot },
  { to: "/assistant", label: "Trợ lý AI", icon: Bot },
  { to: "/profile", label: "Hồ sơ", icon: UserRound },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav>{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-user"><span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div><button onClick={logout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>
    <main className="main-content"><Outlet /></main>
    <nav className="mobile-nav">{links.slice(0, 5).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
  </div>;
}
