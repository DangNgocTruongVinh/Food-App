import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/home/${path}`;

/**
 * Hero kiểu tạp chí ẩm thực: nền ngà, tiêu đề xanh rừng, ảnh món ăn thật tràn mép phải (≥ 1024px) hoặc tràn bề ngang dưới chữ.
 * Ảnh: Monaz Hastam, Unsplash License (public/assets/home/NGUON.txt).
 */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="ld-hero" aria-labelledby="ld-hero-title">
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
      <div className="ld-hero__visual">
        <img
          className="ld-hero__photo"
          src={asset("hero-1200.webp")}
          srcSet={`${asset("hero-720.webp")} 720w, ${asset("hero-1200.webp")} 1200w`}
          sizes="(min-width: 1024px) 55vw, 100vw"
          alt="Bữa sáng nhìn từ trên xuống dưới nắng: salad trứng, bát granola chuối, bánh pancake dâu và cà phê trên bàn gỗ"
          width={1200}
          height={1500}
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
