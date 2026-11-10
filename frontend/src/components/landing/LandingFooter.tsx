import { Link } from "react-router-dom";
import { landingLink } from "../../features/landing/landing.logic";
import { FOOTER_GROUPS } from "../../features/layout/layout.logic";
import { Logo } from "../ui";

/**
 * Footer của trang chủ (nền xanh rừng, cùng nhóm liên kết với footer chung FOOTER_GROUPS). Khách bấm trang cần đăng nhập thì
 * qua đăng nhập rồi quay lại đúng trang; trang Thông tin (chính sách, điều khoản) mở thẳng.
 */
export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  const publicPaths = new Set(["/privacy", "/terms"]);
  return (
    <footer className="ld-footer">
      <div className="ld-footer__inner">
        <section className="ld-footer__brand" aria-label="Giới thiệu Nouri">
          <Link to="/" className="ld-brand" aria-label="Nouri, về trang chủ"><Logo /></Link>
          <p className="ld-footer__tagline">Ăn ngon hơn. Sống khỏe hơn.</p>
          <p className="ld-footer__text">Quản lý tủ bếp, lên thực đơn theo mục tiêu dinh dưỡng và nấu từ những gì bạn đang có.</p>
          <p className="ld-footer__copy">© 2026 Nouri</p>
        </section>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} className="ld-footer__group" aria-label={group.title}>
            <h2 className="ld-footer__title">{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link className="ld-footer__link" to={publicPaths.has(link.to) ? link.to : landingLink(link.to, signedIn)}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
