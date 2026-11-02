import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  const tabsRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Màn hẹp: thanh tab cuộn ngang, đưa tab đang chọn vào khung nhìn (chỉ cuộn thanh tab, không cuộn trang).
  useEffect(() => {
    const reveal = () => {
      const tabs = tabsRef.current;
      const active = tabs?.querySelector<HTMLElement>(".ad-tab.is-active");
      if (!tabs || !active) return;
      const overflowRight = active.offsetLeft + active.offsetWidth - (tabs.scrollLeft + tabs.clientWidth);
      if (overflowRight > 0) tabs.scrollLeft += overflowRight;
      else if (active.offsetLeft < tabs.scrollLeft) tabs.scrollLeft = active.offsetLeft;
    };
    reveal();
    // Đo lại khi phông đã tải (chữ tab đổi bề rộng).
    void document.fonts?.ready.then(reveal);
  }, [pathname]);

  return (
    <div className="ad-view">
      <header className="ad-head">
        <h1 className="ui-title ad-head__title">Quản trị Nouri</h1>
        <nav ref={tabsRef} className="ad-tabs" aria-label="Mục quản trị">
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
