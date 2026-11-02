import { loginPath } from "../../features/auth/auth.logic";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { cx } from "../../features/ui/ui.logic";
import type { FeaturedRecipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { ButtonLink, RecipeImage } from "../ui";

/**
 * Hero: một câu nói rõ Nouri làm gì + 2 nút. Có món mang ảnh thật thì đặt ảnh bên phải (điện thoại: dưới chữ);
 * chưa có thì hero chỉ có chữ. Cột chữ giữ cùng bề rộng ở cả hai trường hợp để ảnh hiện sau khi tải không làm chữ chạy lại.
 */
export function LandingHero({ signedIn, photo }: { signedIn: boolean; photo: FeaturedRecipe | null }) {
  return (
    <section className={cx("ld-hero", photo && "ld-hero--photo")} aria-labelledby="ld-hero-title">
      <div className="ld-hero__inner">
        <div className="ld-hero__copy">
          <h1 id="ld-hero-title" className="ui-hero-title">Biết tủ bếp còn gì,<br /> tuần này ăn gì.</h1>
          <p className="ld-hero__lead">
            Nouri ghi lại thực phẩm trong tủ bếp kèm hạn sử dụng, xếp thực đơn 7 ngày theo calo, chế độ ăn và dị ứng trong hồ sơ
            của bạn, và nhắc dùng trước những món sắp hết hạn.
          </p>
          <div className="ld-actions">
            {signedIn ? (
              <ButtonLink variant="primary" to="/dashboard">Về Tổng quan</ButtonLink>
            ) : (
              <>
                <ButtonLink variant="primary" to={loginPath({ mode: "register" })}>Đăng ký miễn phí</ButtonLink>
                <ButtonLink to="/login">Đăng nhập</ButtonLink>
              </>
            )}
          </div>
          {!signedIn && <p className="ui-small">Đăng ký chỉ cần tên, email và mật khẩu.</p>}
        </div>
        {photo && (
          <figure className="ld-hero__figure">
            <RecipeImage className="ld-hero__image" recipe={photo} width={IMAGE_WIDTHS.hero} alt={`Món ${photo.name}`} loading="eager" />
            <figcaption className="ui-small">{photo.name}, {formatNumber(photo.calories)} kcal một khẩu phần.</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
