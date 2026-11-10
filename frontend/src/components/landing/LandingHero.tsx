import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/home/${path}`;

/**
 * Hero theo ảnh tham chiếu: chữ căn trái trên nền ngà; ảnh món ăn thật chiếm nửa phải, mép trái mờ dần vào nền (≥ 1024px).
 * Màn hẹp: chữ trên, ảnh dưới. Ảnh: Monaz Hastam, Unsplash License (public/assets/home/NGUON.txt).
 */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="ld-hero" aria-labelledby="ld-hero-title">
      <div className="ld-hero__visual">
        <img
          className="ld-hero__photo"
          src={asset("hero-wide-1600.webp")}
          srcSet={`${asset("hero-wide-900.webp")} 900w, ${asset("hero-wide-1600.webp")} 1600w`}
          sizes="(min-width: 1024px) 62vw, 100vw"
          alt="Bàn ăn sáng dưới nắng: bát rau củ với trứng, nấm, cà rốt, đĩa bánh mì nướng, bát granola trái cây"
          width={1600}
          height={1056}
          fetchPriority="high"
        />
      </div>
      <div className="ld-hero__inner">
        <div className="ld-hero__copy">
          <h1 id="ld-hero-title" className="ld-hero__title">Biết tủ bếp còn gì,<br /> tuần này ăn gì.</h1>
          <p className="ld-hero__lead">
            Nouri ghi lại thực phẩm trong tủ kèm hạn sử dụng, xếp thực đơn 7 ngày theo calo, chế độ ăn và dị ứng của bạn,
            và nhắc dùng trước những món sắp hết hạn.
          </p>
          <div className="ld-hero__actions">
            {signedIn ? (
              <Link className="ld-btn ld-btn--solid ld-btn--lg" to="/dashboard">Về Tổng quan</Link>
            ) : (
              <>
                <Link className="ld-btn ld-btn--solid ld-btn--lg" to={loginPath({ mode: "register" })}>Đăng ký miễn phí</Link>
                <Link className="ld-btn ld-btn--outline-ink ld-btn--lg" to="/login">Đăng nhập</Link>
              </>
            )}
          </div>
          {!signedIn && <p className="ld-hero__note">Đăng ký chỉ cần tên, email và mật khẩu.</p>}
        </div>
      </div>
    </section>
  );
}
