import { loginPath } from "../../features/auth/auth.logic";
import { LANDING_COMMUNITY } from "../../features/landing/landing.data";
import { ButtonLink } from "../ui";

/** "Cộng đồng": chỉ mô tả chức năng có thật, không số thành viên, không bài mẫu. */
export function LandingCommunity({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="cong-dong" className="ld-section" aria-labelledby="ld-community-title">
      <div className="ld-section__inner ld-split">
        <h2 id="ld-community-title" className="ui-section-title">Cộng đồng bếp nhà</h2>
        <div className="ld-split__body">
          {LANDING_COMMUNITY.map((text) => <p key={text} className="ld-text">{text}</p>)}
          <ButtonLink className="ld-split__action" to={signedIn ? "/community" : loginPath({ next: "/community" })}>
            {signedIn ? "Mở Cộng đồng" : "Đăng nhập để xem Cộng đồng"}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
