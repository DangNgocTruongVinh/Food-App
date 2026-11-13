import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteHeader } from "../components/layout/SiteHeader";
import { ButtonLink } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { adminRedirect, isAdmin } from "../features/layout/layout.logic";
import { ErrorBoundary } from "../components/ErrorBoundary";

/**
 * Khung các trang trong ứng dụng (DESIGN.md mục 13): menu trên, nội dung, footer.
 * ADMIN không dùng khu người dùng: mở trang người dùng thì về /admin, trừ xem trước công thức (/recipes/:id) — khi đó có dải
 * "Về trang quản trị" ngay dưới menu.
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const redirect = adminRedirect(user, pathname);
  if (redirect) return <Navigate to={redirect} replace />;

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <SiteHeader user={user} onLogout={logout} />
      {isAdmin(user) && (
        <div className="ad-preview-bar" role="note">
          <p className="ad-preview-bar__text"><ShieldCheck aria-hidden="true" />Bạn đang xem trước công thức như người dùng thấy.</p>
          <ButtonLink to="/admin/recipes">Về trang quản trị</ButtonLink>
        </div>
      )}
      <main id="noi-dung-chinh" tabIndex={-1} className="ui-shell__main">
        {/* Trang tải khi mở (lazy): giữ menu/khung trong lúc tải. */}
        <ErrorBoundary key={pathname}><Suspense fallback={null}><Outlet /></Suspense></ErrorBoundary>
      </main>
      <SiteFooter />
    </div>
  );
}
