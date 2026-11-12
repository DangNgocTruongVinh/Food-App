import { Link } from "react-router-dom";
import { FOOTER_GROUPS } from "../../features/layout/layout.logic";
import { NouriWordmark } from "../ui";

/** Footer chung (DESIGN.md mục 13, đồng bộ footer trang chủ 11/11/2026): nền xanh rừng, gọn một hàng; thương hiệu + liên kết tới trang có thật. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <section className="site-footer__brand" aria-label="Giới thiệu Nouri">
          <Link to="/" className="site-footer__logo" aria-label="Nouri, về trang chủ"><NouriWordmark /></Link>
          <p className="site-footer__tagline">Ăn ngon hơn. Sống khỏe hơn.</p>
          <p className="site-footer__text">Quản lý tủ bếp, lên thực đơn theo mục tiêu dinh dưỡng và nấu từ những gì bạn đang có.</p>
          <p className="site-footer__copy">© 2026 Nouri · Đồ án tốt nghiệp</p>
        </section>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.title} className="site-footer__group" aria-label={group.title}>
            <h2 className="site-footer__title">{group.title}</h2>
            <ul>
              {group.links.map((link) => <li key={link.to}><Link to={link.to} className="site-footer__link">{link.label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
