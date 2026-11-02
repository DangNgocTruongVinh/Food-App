import { NavLink, Outlet } from "react-router-dom";
import { cx } from "../features/ui/ui.logic";

const TABS = [
  { to: "/admin", label: "Thống kê", end: true },
  { to: "/admin/recipes", label: "Công thức", end: false },
  { to: "/admin/users", label: "Người dùng", end: false },
  { to: "/admin/moderation", label: "Kiểm duyệt", end: false },
  { to: "/admin/audit-logs", label: "Nhật ký", end: false },
];

/** Khung trang Quản trị (trang công cụ, không ảnh): đầu trang gọn + tab điều hướng, mỗi tab một route riêng. */
export default function AdminLayout() {
  return (
    <div className="ad-view">
      <header className="ad-head">
        <h1 className="ui-title ad-head__title">Quản trị <em>Nouri</em></h1>
        <nav className="ad-tabs" aria-label="Mục quản trị">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => cx("ad-tab", isActive && "is-active")}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
