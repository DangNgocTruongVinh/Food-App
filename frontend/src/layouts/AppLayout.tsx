import { Outlet, useLocation } from "react-router-dom";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteHeader } from "../components/layout/SiteHeader";
import { useAuth } from "../contexts/AuthContext";
import { isRedesignedRoute } from "../features/layout/layout.logic";

// Lớp main-theme-*, app-overview-palette, topbar-layout, main-content chỉ còn để CSS cũ của từng trang bám vào;
// gỡ dần khi trang đó được làm lại (UI-3 → UI-10).
const legacyTheme = (pathname: string) => (pathname.startsWith("/pantry") ? "pantry"
  : pathname.startsWith("/meal-plans") ? "menu"
    : pathname.startsWith("/recipes") ? "recipes"
      : pathname.startsWith("/assistant") ? "assistant"
        : pathname.startsWith("/profile") ? "profile"
          : "overview");

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const redesigned = isRedesignedRoute(pathname);

  return (
    <div className="ui-shell topbar-layout">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <SiteHeader user={user} onLogout={logout} />
      <main
        id="noi-dung-chinh"
        tabIndex={-1}
        // Trang chưa làm lại: nội dung luôn ở chế độ sáng (CSS cũ đặt chữ tối thẳng trên nền).
        data-theme={redesigned ? undefined : "light"}
        className={redesigned ? "ui-shell__main" : `ui-shell__main ui-shell__main--legacy main-content main-theme-${legacyTheme(pathname)} app-overview-palette`}
      >
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
