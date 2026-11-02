import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { LANDING_SECTIONS } from "../../features/landing/landing.data";
import { useDisclosure } from "../../features/layout/useDisclosure";
import { ButtonLink, Logo, ThemeToggle } from "../ui";

/**
 * Menu trên của Landing (bản cho khách, cùng khung DESIGN.md mục 13): logo, liên kết neo tới các phần, chế độ tối,
 * nút Đăng nhập (đã đăng nhập: "Về Tổng quan"). ≤ 1200px liên kết neo thu vào nút menu như menu ứng dụng.
 */
export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  const mobile = useDisclosure<HTMLElement>();
  const links = (onClick?: () => void) => LANDING_SECTIONS.map(({ id, label }) => (
    <li key={id}><a href={`#${id}`} className="site-nav__link" onClick={onClick}>{label}</a></li>
  ));
  return (
    <header className="site-header" ref={mobile.rootRef}>
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Nouri, trang chủ"><Logo /></Link>
        <nav className="site-nav" aria-label="Các phần của trang">
          <ul className="site-nav__pills">{links()}</ul>
        </nav>
        <div className="site-header__actions">
          <ThemeToggle className="site-header__icon" />
          <ButtonLink to={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Về Tổng quan" : "Đăng nhập"}</ButtonLink>
          <button type="button" className="ui-icon-button site-header__menu-button" {...mobile.buttonProps} aria-label="Các phần của trang">
            {mobile.open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id={mobile.panelId} className="site-mobile-nav" aria-label="Các phần của trang" hidden={!mobile.open}>
        <ul>{links(() => mobile.close())}</ul>
      </nav>
    </header>
  );
}
