import { BookOpenText, CalendarDays, MessagesSquare, ReceiptText, Refrigerator, UsersRound, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { LANDING_FEATURES } from "../../features/landing/landing.data";
import { landingLink } from "../../features/landing/landing.logic";
import { cx } from "../../features/ui/ui.logic";

const ICONS: Record<(typeof LANDING_FEATURES)[number]["icon"], LucideIcon> = {
  pantry: Refrigerator, plan: CalendarDays, recipes: BookOpenText, community: UsersRound, assistant: MessagesSquare,
};

/**
 * "Nouri giúp gì": 5 chức năng có thật. Kho là khối lớn (việc hằng ngày, kèm quét hóa đơn), 4 chức năng còn lại là khối nhỏ.
 * Mỗi khối có một liên kết tới trang thật (khách: qua đăng nhập rồi quay lại đúng trang).
 */
export function LandingFeatures({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="nouri-giup-gi" className="ld-section" aria-labelledby="ld-features-title">
      <div className="ld-section__inner">
        <div className="ld-section__head">
          <h2 id="ld-features-title" className="ld-section__title">Nouri giúp gì trong bếp</h2>
          <p className="ld-section__lead">Năm việc bạn làm được ngay sau khi đăng ký, từ tủ bếp tới bữa ăn.</p>
        </div>
        <ul className="ld-features">
          {LANDING_FEATURES.map((feature, index) => {
            const Icon = ICONS[feature.icon];
            return (
              <li key={feature.key} className={cx("ld-feature", index === 0 && "ld-feature--lead")}>
                <span className="ld-feature__icon" aria-hidden="true"><Icon /></span>
                <h3 className="ld-feature__title">{feature.title}</h3>
                <p className="ld-feature__body">{feature.body}</p>
                {feature.extra && (
                  <p className="ld-feature__extra"><ReceiptText aria-hidden="true" />{feature.extra}</p>
                )}
                <Link className="ld-feature__link" to={landingLink(feature.path, signedIn)}>
                  {feature.action}
                  {!signedIn && <span className="ui-visually-hidden"> (cần đăng nhập)</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
