import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { loginPath } from "../../features/auth/auth.logic";
import { LANDING_SECTIONS } from "../../features/landing/landing.data";
import { useDisclosure } from "../../features/layout/useDisclosure";
import { NouriWordmark, ThemeToggle } from "../ui";

/**
 * Menu trên của trang chủ: logo, liên kết neo tới các phần, chế độ sáng/tối, Đăng nhập + Đăng ký.
 * Đã có phiên ("Giữ tôi đăng nhập"): "Xin chào, <tên>" + "Về Tổng quan" + "Đăng xuất" để người dùng biết mình đang đăng nhập.
 * < 1024px: liên kết neo và nút tài khoản thu vào nút menu (bảng thả xuống).
 */
export function LandingHeader() {
  const { user, logout } = useAuth();
  const mobile = useDisclosure<HTMLElement>();
  const links = (onClick?: () => void) => LANDING_SECTIONS.map(({ id, label }) => (
    <li key={id}><a href={`#${id}`} className="ld-nav__link" onClick={onClick}>{label}</a></li>
  ));
  const account = (onClick?: () => void) => (user ? (
    <>
      <span className="ld-header__greeting" title={user.name}>Xin chào, <strong>{user.name}</strong></span>
      <Link className="ld-btn ld-btn--solid" to="/dashboard" onClick={onClick}>Về Tổng quan</Link>
      <button type="button" className="ld-btn ld-btn--quiet" onClick={logout}>Đăng xuất</button>
    </>
  ) : (
    <>
      <Link className="ld-btn ld-btn--quiet" to="/login" onClick={onClick}>Đăng nhập</Link>
      <Link className="ld-btn ld-btn--solid" to={loginPath({ mode: "register" })} onClick={onClick}>Đăng ký</Link>
    </>
  ));

  return (
    <header className="ld-header" ref={mobile.rootRef}>
      <div className="ld-header__inner">
        <Link to="/" className="ld-brand" aria-label="Nouri, trang chủ"><NouriWordmark /></Link>
        <nav className="ld-nav" aria-label="Các phần của trang">
          <ul>{links()}</ul>
        </nav>
        <div className="ld-header__actions">
          <ThemeToggle className="ld-header__icon" />
          <div className="ld-header__account">{account()}</div>
          <button type="button" className="ld-header__menu" {...mobile.buttonProps} aria-label="Mở menu trang chủ">
            {mobile.open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id={mobile.panelId} className="ld-mobile-nav" aria-label="Các phần của trang" hidden={!mobile.open}>
        <ul>{links(() => mobile.close())}</ul>
        <div className="ld-mobile-nav__account">{account(() => mobile.close())}</div>
      </nav>
    </header>
  );
}
