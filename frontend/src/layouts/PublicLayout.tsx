import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PublicHeader } from "../components/layout/PublicHeader";
import { SiteFooter } from "../components/layout/SiteFooter";
import { ErrorBoundary } from "../components/ErrorBoundary";

/** Khung cho trang công khai theo giao diện mới (Chính sách bảo mật, Điều khoản sử dụng). */
export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <PublicHeader />
      <main id="noi-dung-chinh" tabIndex={-1} className="ui-shell__main"><ErrorBoundary key={pathname}><Suspense fallback={null}><Outlet /></Suspense></ErrorBoundary></main>
      <SiteFooter />
    </div>
  );
}
