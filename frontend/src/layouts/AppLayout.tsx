import { Outlet } from "react-router-dom";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteHeader } from "../components/layout/SiteHeader";
import { useAuth } from "../contexts/AuthContext";

/** Khung các trang trong ứng dụng (DESIGN.md mục 13): menu trên, nội dung, footer. */
export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <SiteHeader user={user} onLogout={logout} />
      <main id="noi-dung-chinh" tabIndex={-1} className="ui-shell__main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
