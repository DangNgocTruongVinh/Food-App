import { Link } from "react-router-dom";
import { LANDING_COMMUNITY } from "../../features/landing/landing.data";
import { landingLink } from "../../features/landing/landing.logic";

/** "Cộng đồng": chỉ mô tả chức năng có thật, không số thành viên, không bài mẫu. */
export function LandingCommunity({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="cong-dong" className="ld-section ld-section--soft" aria-labelledby="ld-community-title">
      <div className="ld-section__inner ld-split">
        <h2 id="ld-community-title" className="ld-section__title">Cộng đồng bếp nhà</h2>
        <div className="ld-split__body">
          {LANDING_COMMUNITY.map((text) => <p key={text} className="ld-text">{text}</p>)}
          <Link className="ld-btn ld-btn--outline-ink ld-split__action" to={landingLink("/community", signedIn)}>
            {signedIn ? "Mở Cộng đồng" : "Đăng nhập để xem Cộng đồng"}
          </Link>
        </div>
      </div>
    </section>
  );
}
