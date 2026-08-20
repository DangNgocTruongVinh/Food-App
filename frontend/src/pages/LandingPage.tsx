import {
  ArrowRight, Bookmark, CalendarDays, Check, Clock3, Flame,
  HeartPulse, Leaf, Menu, Moon, Sparkles, UsersRound, Utensils, X,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const features = [
  { icon: CalendarDays, title: "Lên thực đơn thông minh", copy: "Tạo thực đơn theo nhu cầu, sở thích và mục tiêu sức khỏe.", href: "#plan" },
  { icon: Utensils, title: "Công thức đa dạng", copy: "Hàng ngàn công thức ngon, dễ làm và giàu dinh dưỡng.", href: "#recipes" },
  { icon: HeartPulse, title: "Theo dõi dinh dưỡng", copy: "Kiểm soát calo và dưỡng chất dễ dàng mỗi ngày.", href: "#plan" },
  { icon: UsersRound, title: "Cộng đồng truyền cảm hứng", copy: "Chia sẻ món ngon, mẹo hay và hành trình lành mạnh.", href: "#community" },
];

const recipes = [
  { image: "/assets/recipe-vegan-bowl.jpg", name: "Salad ức gà sốt chanh dây", time: "20 phút", level: "Dễ" },
  { image: "/assets/recipe-salmon.jpg", name: "Cá hồi áp chảo sốt bơ tỏi", time: "25 phút", level: "Trung bình" },
  { image: "/assets/nutrition-hero.jpg", name: "Bowl quinoa rau củ nướng", time: "30 phút", level: "Dễ" },
  { image: "/assets/recipe-oats.jpg", name: "Yến mạch trái cây bổ dưỡng", time: "15 phút", level: "Dễ" },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const appLink = user ? "/dashboard" : "/login";

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".landing-header-inner", { y: -28, opacity: 0, duration: 0.8 })
      .from(".landing-hero-copy > *", { y: 30, opacity: 0, duration: 0.7, stagger: 0.09 }, "-=0.42")
      .from(".landing-hero-image-shell", { scale: 0.86, opacity: 0, duration: 1.1 }, "-=0.72")
      .from(".landing-hero-visual article", { x: 28, opacity: 0, duration: 0.6, stagger: 0.1 }, "-=0.7");

    gsap.to(".landing-hero-leaf.leaf-one", { y: 13, rotation: -36, duration: 3.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".landing-hero-leaf.leaf-two", { y: -11, rotation: 24, duration: 4.4, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".landing-nutrition-card", { y: -8, duration: 4.2, repeat: -1, yoyo: true, ease: "sine.inOut" });

    gsap.utils.toArray<HTMLElement>(".landing-feature-intro, .landing-recipe-heading, .landing-section-heading, .landing-community .landing-container").forEach((element) => {
      gsap.from(element, {
        y: 48,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 86%", once: true },
      });
    });

    gsap.from(".landing-feature-grid article", {
      y: 56,
      opacity: 0,
      duration: 0.85,
      stagger: 0.1,
      ease: "power3.out",
      scrollTrigger: { trigger: ".landing-feature-grid", start: "top 84%", once: true },
    });

    gsap.utils.toArray<HTMLElement>(".landing-recipe-grid article > div").forEach((media) => {
      gsap.fromTo(media,
        { scale: 0.88, opacity: 0.45 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: media,
            start: "top 95%",
            end: "center 58%",
            scrub: 0.8,
          },
        },
      );
    });

    gsap.fromTo(".landing-plan-copy > p",
      { opacity: 0.18 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".landing-plan-card",
          start: "top 78%",
          end: "top 34%",
          scrub: true,
        },
      },
    );
  }, { scope: pageRef });

  return <div className="landing-page" ref={pageRef}>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link to="/" className="landing-brand" aria-label="Nouri - Trang chủ"><Logo /></Link>
        <nav className={menuOpen ? "landing-nav open" : "landing-nav"} aria-label="Điều hướng trang chủ">
          <a className="active" href="#home" onClick={() => setMenuOpen(false)}>Trang chủ</a>
          <a href="#recipes" onClick={() => setMenuOpen(false)}>Công thức</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Tính năng</a>
          <a href="#plan" onClick={() => setMenuOpen(false)}>Kế hoạch ăn uống</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>Cộng đồng</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>Về Nouri</a>
        </nav>
        <div className="landing-header-actions">
          <button className="landing-theme-button" type="button" aria-label="Giao diện sáng"><Moon /></button>
          <Link className="landing-login" to={appLink}>{user ? "Vào ứng dụng" : "Đăng nhập"}</Link>
          <button className="landing-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero" id="home">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><Leaf /> Dinh dưỡng khoa học <i /> Sống khỏe mỗi ngày</span>
            <h1>Ăn ngon,<br />sống khỏe<br /><em>mỗi ngày</em></h1>
            <p>Nouri giúp bạn lên thực đơn thông minh, gợi ý công thức phù hợp và cân bằng dinh dưỡng cho cuộc sống khỏe mạnh hơn.</p>
            <div className="landing-hero-benefits">
              <article><Sparkles /><span><strong>Gợi ý cá nhân hóa</strong><small>Theo nhu cầu</small></span></article>
              <article><CalendarDays /><span><strong>Kế hoạch ăn uống</strong><small>Khoa học</small></span></article>
              <article><HeartPulse /><span><strong>Cân bằng dinh dưỡng</strong><small>Cho lối sống khỏe</small></span></article>
            </div>
            <div className="landing-hero-actions">
              <Link className="landing-primary-button" to={appLink}><Sparkles /> Bắt đầu ngay <ArrowRight /></Link>
            </div>
          </div>

          <div className="landing-hero-visual" aria-label="Bữa ăn lành mạnh với gà, rau xanh và quả bơ">
            <div className="landing-hero-image-shell"><img src="/assets/nutrition-hero.jpg" alt="Bowl gà, quả bơ, cà chua và rau xanh giàu dinh dưỡng" /></div>
            <Leaf className="landing-hero-leaf leaf-one" aria-hidden="true" />
            <Leaf className="landing-hero-leaf leaf-two" aria-hidden="true" />
            <article className="landing-nutrition-card">
              <header><div><strong>Bữa sáng hôm nay</strong><span>450 kcal <i /> Cân bằng</span></div><HeartPulse /></header>
              <ul>
                <li><Flame /><span>Giàu protein</span></li>
                <li><Leaf /><span>Nhiều chất xơ</span></li>
                <li><HeartPulse /><span>Tốt cho tim mạch</span></li>
              </ul>
              <a href="#recipes">Xem chi tiết <ArrowRight /></a>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-features" id="features">
        <div className="landing-container">
          <div className="landing-feature-intro"><span>NOURI GIÚP BẠN <Leaf /></span><h2>Trải nghiệm nấu ăn đơn giản hơn, lành mạnh hơn và thú vị hơn.</h2></div>
          <div className="landing-feature-grid">{features.map(({ icon: Icon, title, copy, href }, index) => <article key={title}><span className={`tone-${index + 1}`}><Icon /></span><div><h3>{title}</h3><p>{copy}</p></div><a href={href} aria-label={`Khám phá ${title}`}><ArrowRight /></a></article>)}</div>
        </div>
      </section>

      <section className="landing-section landing-recipes" id="recipes">
        <div className="landing-container">
          <div className="landing-recipe-heading"><h2>Công thức nổi bật <Leaf /></h2><Link to={appLink}>Xem tất cả <ArrowRight /></Link></div>
          <div className="landing-recipe-grid">{recipes.map((recipe) => <article key={recipe.name}><div><img src={recipe.image} alt={recipe.name} /><button type="button" aria-label={`Lưu ${recipe.name}`}><Bookmark /></button></div><h3>{recipe.name}</h3><p><Clock3 /> {recipe.time}<i />{recipe.level}</p></article>)}</div>
        </div>
      </section>

      <section className="landing-trusted" aria-label="Thương hiệu tin dùng">
        <div className="landing-container"><span>Được tin dùng bởi</span><div className="landing-marquee"><div><b>VNEXPRESS</b><b>CAFEF</b><b>GENK</b><b>THANH NIÊN</b><b>FOODY</b><b>aFamily</b></div><div aria-hidden="true"><b>VNEXPRESS</b><b>CAFEF</b><b>GENK</b><b>THANH NIÊN</b><b>FOODY</b><b>aFamily</b></div></div></div>
      </section>

      <section className="landing-section landing-plan-section" id="plan">
        <div className="landing-container landing-plan-card">
          <div className="landing-plan-copy"><span>AI Meal Plan</span><h2>Kế hoạch ăn uống<br />được tạo riêng cho bạn<br />bởi AI.</h2><p>Chỉ cần trả lời vài câu hỏi đơn giản, Nouri sẽ tạo kế hoạch ăn uống phù hợp với mục tiêu và lối sống của bạn.</p><ul><li><Check /> Phù hợp mục tiêu cá nhân</li><li><Check /> Cân bằng dinh dưỡng</li><li><Check /> Tiết kiệm thời gian</li></ul><Link to={appLink}>Tạo kế hoạch của tôi <ArrowRight /></Link></div>
          <div className="landing-phone" aria-label="Xem trước kế hoạch ăn uống"><div className="landing-phone-notch" /><header><strong>Kế hoạch của bạn</strong><small>19 – 25 Tháng 5, 2025</small></header><nav><b>T2<small>19</small></b><span>T3<small>20</small></span><span>T4<small>21</small></span><span>T5<small>22</small></span><span>T6<small>23</small></span><span>T7<small>24</small></span></nav><section><span>Bữa sáng <small>525 kcal</small></span><article><img src="/assets/recipe-oats.jpg" alt="" /><div><strong>Yến mạch trái cây & hạt</strong><small>1 khẩu phần</small></div></article><span>Bữa trưa <small>650 kcal</small></span><article><img src="/assets/recipe-salmon.jpg" alt="" /><div><strong>Cơm gạo lứt, cá áp chảo</strong><small>Khẩu phần cân bằng</small></div></article></section></div>
          <div className="landing-plan-stats"><article><span>Mục tiêu của bạn</span><strong>Giảm cân <small>-0.6 kg/tuần</small></strong><i><b /></i></article><article><span>Chỉ số cơ thể</span><p>Cân nặng <b>60 kg</b></p><p>BMI <b>21.5</b></p><p>Tỷ lệ mỡ <b>22%</b></p></article></div>
        </div>
      </section>

      <section className="landing-community" id="community"><div className="landing-container"><HeartPulse /><div><span>Cộng đồng Nouri</span><h2>Cùng nhau sống khỏe hơn mỗi ngày.</h2><p>Chia sẻ hành trình, tìm cảm hứng và nhận lời khuyên từ cộng đồng yêu lối sống lành mạnh.</p></div><Link to={appLink}>Tham gia ngay <ArrowRight /></Link></div></section>
    </main>

    <footer className="landing-footer" id="about"><div className="landing-container"><Logo /><p>Nền tảng dinh dưỡng thông minh dành cho cuộc sống khỏe mạnh và bền vững.</p><small>© 2026 Nouri. All rights reserved.</small></div></footer>
  </div>;
}
