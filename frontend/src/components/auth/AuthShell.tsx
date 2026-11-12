import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../ui";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/login/${path}`;

/** Khung chung của trang đăng nhập, quên mật khẩu, đặt mật khẩu mới: ảnh món bên trái, cột form xanh bên phải. */
export function AuthShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dn-page">
      <div className="dn-photo">
        <picture>
          <source media="(max-width: 1023px)" srcSet={asset("hero-mobile.jpg")} />
          <img src={asset("hero-desktop.jpg")} alt="Đĩa cá hồi áp chảo với đậu que, cà chua bi và cơm súp lơ" />
        </picture>
        <div className="dn-scrim" />
        <p className="dn-slogan">Hôm nay ăn gì cho khỏe?</p>
      </div>
      <main id="noi-dung-chinh" className="dn-panel" aria-label={label}>
        <div className="dn-bar">
          <Link to="/" className="dn-logo" aria-label="Nouri, trang chủ"><Logo /></Link>
        </div>
        <div className="dn-wrap">{children}</div>
        {/* Điều khoản ở chân cột form: thông tin phụ, không chen vào giữa các thao tác đăng nhập. */}
        <p className="dn-legal">
          Khi tiếp tục, bạn đồng ý với <Link className="dn-legal__link" to="/terms">Điều khoản sử dụng</Link> và{" "}
          <Link className="dn-legal__link" to="/privacy">Chính sách bảo mật</Link> của Nouri.
        </p>
      </main>
    </div>
  );
}
