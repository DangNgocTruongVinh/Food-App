import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";
import { HeroMealPlanMockup } from "./HeroMealPlanMockup";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/home/${path}`;

/**
 * Hero "bàn ăn trong vòm": nền ngà, mảng xanh rừng tràn mép phải; một ảnh bàn ăn thật (nhiều bữa, nhìn từ trên) trong khung vòm
 * cao đặt vắt qua ranh giới hai mảng màu; mockup màn Thực đơn đè lên góc dưới vòm, nối ảnh với cột chữ. Hero cao vừa một màn hình.
 * Ảnh do người dùng cung cấp (public/assets/home/NGUON.txt).
 */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="ld-hero" aria-labelledby="ld-hero-title">
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
              <Link className="ld-btn ld-btn--solid ld-btn--lg" to={loginPath({ mode: "register" })}>Đăng ký miễn phí</Link>
            )}
            <a className="ld-btn ld-btn--outline-ink ld-btn--lg" href="#cach-hoat-dong">Xem cách hoạt động</a>
          </div>
        </div>

        <div className="ld-hero__visual">
          <img
            className="ld-hero__photo"
            src={asset("hero-table-960.webp")}
            srcSet={`${asset("hero-table-560.webp")} 560w, ${asset("hero-table-960.webp")} 960w`}
            sizes="(max-width: 1023px) min(78vw, 420px), 440px"
            alt="Bàn gỗ nắng chiều bày nhiều bữa: salad trứng, bát yến mạch trái cây, bánh mì giăm bông, bánh kếp và cà phê."
            width={960}
            height={1438}
            fetchPriority="high"
          />
          <HeroMealPlanMockup />
        </div>
      </div>
    </section>
  );
}
