import { ChevronDown, LogOut, Shield, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { accountMenuItems, userInitial } from "../../features/layout/layout.logic";
import { useDisclosure } from "../../features/layout/useDisclosure";
import type { User } from "../../types";

const iconFor = (to: string) => (to === "/admin" ? <Shield aria-hidden="true" /> : <UserRound aria-hidden="true" />);

/** Nút tài khoản (ảnh đại diện chữ + tên) mở menu Hồ sơ / Quản trị (chỉ ADMIN) / Đăng xuất. */
export function AccountMenu({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const { open, rootRef, panelId, buttonProps, close } = useDisclosure();
  return (
    <div className="account-menu" ref={rootRef}>
      <button type="button" className="account-menu__button" {...buttonProps} aria-label={`Tài khoản: ${user?.name ?? "Người dùng"}`}>
        <span className="account-menu__avatar" aria-hidden="true">{userInitial(user?.name)}</span>
        <span className="account-menu__name" aria-hidden="true">{user?.name}</span>
        <ChevronDown className="account-menu__chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="account-menu__panel" hidden={!open}>
        <p className="account-menu__who">
          <span className="account-menu__who-name">{user?.name}</span>
          <span className="account-menu__who-email">{user?.email}</span>
        </p>
        <ul className="account-menu__list">
          {accountMenuItems(user).map((item) => (
            <li key={item.label}>
              {item.kind === "link"
                ? <Link to={item.to} className="account-menu__item" onClick={() => close()}>{iconFor(item.to)}<span>{item.label}</span></Link>
                : (
                  <button type="button" className="account-menu__item" onClick={() => { close(); onLogout(); }}>
                    <LogOut aria-hidden="true" /><span>{item.label}</span>
                  </button>
                )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
