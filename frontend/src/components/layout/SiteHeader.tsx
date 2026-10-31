import { Menu, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { PRIMARY_NAV } from "../../features/layout/layout.logic";
import { useDisclosure } from "../../features/layout/useDisclosure";
import type { User } from "../../types";
import NotificationCenter from "../notifications/NotificationCenter";
import { Logo, ThemeToggle } from "../ui";
import { AccountMenu } from "./AccountMenu";

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "site-nav__link is-active" : "site-nav__link");

/**
 * Menu trên (DESIGN.md mục 13): logo, nhóm liên kết dạng viên, chế độ tối, chuông thông báo, tài khoản.
 * ≤ 1200px nhóm liên kết thu vào nút "Menu" (mở danh sách ngay dưới, đóng bằng Esc hoặc khi chuyển trang).
 */
export function SiteHeader({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const mobile = useDisclosure<HTMLElement>();
  return (
    <header className="site-header" ref={mobile.rootRef}>
      <div className="site-header__inner">
        <Link to="/dashboard" className="site-header__brand" aria-label="Nouri, về trang Tổng quan"><Logo /></Link>

        <nav className="site-nav" aria-label="Điều hướng chính">
          <ul className="site-nav__pills">
            {PRIMARY_NAV.map(({ to, label, end }) => <li key={to}><NavLink to={to} end={end} className={navClass}>{label}</NavLink></li>)}
          </ul>
        </nav>

        <div className="site-header__actions">
          <ThemeToggle className="site-header__icon" />
          <NotificationCenter />
          <AccountMenu user={user} onLogout={onLogout} />
          <button
            type="button"
            className="ui-icon-button site-header__menu-button"
            {...mobile.buttonProps}
            aria-label="Menu điều hướng"
          >
            {mobile.open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav id={mobile.panelId} className="site-mobile-nav" aria-label="Điều hướng chính" hidden={!mobile.open}>
        <ul>
          {PRIMARY_NAV.map(({ to, label, end }) => (
            <li key={to}><NavLink to={to} end={end} className={navClass} onClick={() => mobile.close()}>{label}</NavLink></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
