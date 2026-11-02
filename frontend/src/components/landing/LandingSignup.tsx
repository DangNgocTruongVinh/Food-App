import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";
import { ButtonLink } from "../ui";

/** Lời kêu gọi cuối trang: một nút chính (đăng ký), đăng nhập là liên kết phụ. */
export function LandingSignup({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="ld-signup" aria-labelledby="ld-signup-title">
      <div className="ld-section__inner ld-signup__inner">
        <h2 id="ld-signup-title" className="ui-section-title">{signedIn ? "Tiếp tục với tủ bếp của bạn" : "Bắt đầu từ tủ bếp nhà bạn"}</h2>
        <p className="ld-text">
          {signedIn
            ? "Món sắp hết hạn, bữa hôm nay và thực đơn đang áp dụng đều ở trang Tổng quan."
            : "Tạo tài khoản, thêm vài thực phẩm đang có và điền hồ sơ: thực đơn 7 ngày đầu tiên tạo được ngay sau đó."}
        </p>
        <div className="ld-actions">
          {signedIn ? (
            <ButtonLink variant="primary" to="/dashboard">Về Tổng quan</ButtonLink>
          ) : (
            <>
              <ButtonLink variant="primary" to={loginPath({ mode: "register" })}>Đăng ký miễn phí</ButtonLink>
              <p className="ui-small">Đã có tài khoản? <Link className="ui-link" to="/login">Đăng nhập</Link></p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
