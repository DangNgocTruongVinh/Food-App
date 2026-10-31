import { Link } from "react-router-dom";
import { getAuthToken } from "../../features/auth/auth.storage";
import { ButtonLink, Logo, ThemeToggle } from "../ui";

/** Đầu trang công khai (Chính sách, Điều khoản): logo, chế độ tối, nút vào ứng dụng hoặc đăng nhập. */
export function PublicHeader() {
  const signedIn = Boolean(getAuthToken());
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Nouri, về trang chủ"><Logo /></Link>
        <div className="site-header__actions">
          <ThemeToggle className="site-header__icon" />
          <ButtonLink to={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Về Tổng quan" : "Đăng nhập"}</ButtonLink>
        </div>
      </div>
    </header>
  );
}
