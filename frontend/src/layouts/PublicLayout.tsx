import { Outlet } from "react-router-dom";
import { PublicHeader } from "../components/layout/PublicHeader";
import { SiteFooter } from "../components/layout/SiteFooter";

/** Khung cho trang công khai theo giao diện mới (Chính sách bảo mật, Điều khoản sử dụng). */
export default function PublicLayout() {
  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <PublicHeader />
      <main id="noi-dung-chinh" tabIndex={-1} className="ui-shell__main"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}
