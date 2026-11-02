import { LANDING_BENEFITS } from "../../features/landing/landing.data";
import { cx } from "../../features/ui/ui.logic";

/** "Nouri giúp gì": 3 việc chính, không icon trang trí; việc đầu lớn hơn (thứ bậc), hai việc sau ngăn bằng đường kẻ. */
export function LandingBenefits() {
  return (
    <section id="nouri-giup-gi" className="ld-section" aria-labelledby="ld-benefits-title">
      <div className="ld-section__inner">
        <h2 id="ld-benefits-title" className="ui-section-title">Nouri giúp gì trong bếp</h2>
        <ul className="ld-benefits">
          {LANDING_BENEFITS.map((benefit, index) => (
            <li key={benefit.title} className={cx("ld-benefit", index === 0 && "ld-benefit--lead")}>
              <h3 className="ld-benefit__title">{benefit.title}</h3>
              <p className="ld-text">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
