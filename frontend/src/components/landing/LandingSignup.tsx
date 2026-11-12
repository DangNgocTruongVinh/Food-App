import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";

/** Lời mời cuối trang (nền xanh rừng): một nút chính (đăng ký), đăng nhập là liên kết phụ. */
export function LandingSignup({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="ld-signup" aria-labelledby="ld-signup-title">
      <div className="ld-signup__inner">
        <div>
          <h2 id="ld-signup-title" className="ld-signup__title">{signedIn ? "Tiếp tục với tủ bếp của bạn" : "Bắt đầu từ tủ bếp nhà bạn"}</h2>
          <p className="ld-signup__text">
            {signedIn
              ? "Món sắp hết hạn, bữa hôm nay và thực đơn đang áp dụng đều ở trang Tổng quan."
              : "Tạo tài khoản, thêm vài thực phẩm đang có và điền hồ sơ: thực đơn 7 ngày đầu tiên tạo được ngay sau đó."}
          </p>
        </div>
        <div className="ld-signup__actions">
          {signedIn ? (
            <Link className="ld-btn ld-btn--gold ld-btn--lg" to="/dashboard">Về Tổng quan</Link>
          ) : (
            <>
              <Link className="ld-btn ld-btn--gold ld-btn--lg" to={loginPath({ mode: "register" })}>Đăng ký miễn phí</Link>
              <p className="ld-signup__login">Đã có tài khoản? <Link className="ld-signup__link" to="/login">Đăng nhập</Link></p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
