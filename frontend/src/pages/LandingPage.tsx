import {
  ArrowLeft, ArrowRight, Bookmark, CalendarDays, Check, ChefHat, Clock3,
  Dumbbell, Flame, Grid2X2, HeartPulse, Leaf, Menu, Moon, Salad,
  Sparkles, Star, Sunrise, UsersRound, Utensils, X,
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
  { image: "/assets/recipe-vegan-bowl.jpg", name: "Salad ức gà sốt chanh dây", description: "Ức gà mềm mọng cùng rau xanh và sốt chanh dây thanh nhẹ, giàu đạm nhưng vẫn tươi mát.", tags: ["Giàu protein", "Eat clean"], time: "20 phút", level: "Dễ", servings: "2 phần" },
  { image: "/assets/recipe-salmon.jpg", name: "Cá hồi áp chảo sốt bơ tỏi", description: "Cá hồi áp chảo vàng cạnh, kết hợp sốt bơ tỏi thơm dịu và rau củ nướng cân bằng.", tags: ["Giàu protein", "Ít carb"], time: "25 phút", level: "Trung bình", servings: "2 phần" },
  { image: "/assets/nutrition-hero.jpg", name: "Bowl quinoa rau củ nướng", description: "Quinoa bùi nhẹ, rau củ theo mùa và quả bơ tạo nên một bữa ăn nhiều chất xơ, đủ năng lượng.", tags: ["Nhiều chất xơ", "Eat clean"], time: "30 phút", level: "Dễ", servings: "2 phần" },
  { image: "/assets/recipe-oats.jpg", name: "Yến mạch trái cây bổ dưỡng", description: "Yến mạch mềm mịn với trái cây, hạt rang và sữa chua cho bữa sáng nhẹ nhàng, no lâu.", tags: ["Bữa sáng", "Thuần chay"], time: "15 phút", level: "Dễ", servings: "1 phần" },
];

const recipeCategories = [
  { id: "all", label: "Tất cả", count: 245, icon: Grid2X2, recipeIndex: 1 },
  { id: "weight-loss", label: "Giảm cân", count: 56, icon: Leaf, recipeIndex: 2 },
  { id: "protein", label: "Giàu protein", count: 48, icon: Dumbbell, recipeIndex: 1 },
  { id: "eat-clean", label: "Eat clean", count: 62, icon: Salad, recipeIndex: 0 },
  { id: "vegan", label: "Thuần chay", count: 40, icon: Leaf, recipeIndex: 2 },
  { id: "breakfast", label: "Bữa sáng", count: 38, icon: Sunrise, recipeIndex: 3 },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuredRecipeIndex, setFeaturedRecipeIndex] = useState(1);
  const [activeRecipeCategory, setActiveRecipeCategory] = useState("all");
  const pageRef = useRef<HTMLDivElement>(null);
  const recipeCarouselRef = useRef<HTMLDivElement>(null);
  const recipeDirectionRef = useRef(1);
  const appLink = user ? "/dashboard" : "/login";
  const getRecipeAt = (offset: number) => recipes[(featuredRecipeIndex + offset + recipes.length) % recipes.length];
  const previousRecipe = getRecipeAt(-1);
  const featuredRecipe = getRecipeAt(0);
  const nextRecipe = getRecipeAt(1);

  const moveRecipe = (direction: -1 | 1) => {
    recipeDirectionRef.current = direction;
    setActiveRecipeCategory("all");
    setFeaturedRecipeIndex((current) => (current + direction + recipes.length) % recipes.length);
  };

  const selectRecipeCategory = (categoryId: string, recipeIndex: number) => {
    recipeDirectionRef.current = recipeIndex >= featuredRecipeIndex ? 1 : -1;
    setActiveRecipeCategory(categoryId);
    setFeaturedRecipeIndex(recipeIndex);
  };

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

    const featureSection = pageRef.current?.querySelector<HTMLElement>(".landing-features");
    const featureGrid = pageRef.current?.querySelector<HTMLElement>(".landing-feature-grid");
    const featureCards = gsap.utils.toArray<HTMLElement>(".landing-feature-card-shell");
    const featureMotion = gsap.matchMedia();

    if (featureSection && featureGrid && featureCards.length === 4) {
      featureMotion.add("(hover: hover) and (min-width: 961px)", () => {
        const rotations = [-6, -2, 2.5, 6];
        const verticalOffsets = [16, 2, 4, 18];

        const getStackOffsets = () => {
          const cardWidth = featureCards[0].offsetWidth;
          const fanStep = Math.min(116, Math.max(82, cardWidth * 0.36));
          const gridCenter = featureGrid.clientWidth / 2;

          return featureCards.map((card, index) => {
            const naturalCenter = card.offsetLeft + card.offsetWidth / 2;
            const stackedCenter = gridCenter + (index - 1.5) * fanStep;
            return stackedCenter - naturalCenter;
          });
        };

        const setStack = () => {
          const offsets = getStackOffsets();
          gsap.set(featureCards, {
            x: (index) => offsets[index],
            y: (index) => verticalOffsets[index],
            rotation: (index) => rotations[index],
            transformOrigin: "50% 82%",
            zIndex: (index) => index + 1,
          });
        };

        const expandCards = () => {
          gsap.to(featureCards, {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.95,
            stagger: { each: 0.025, from: "center" },
            ease: "power4.inOut",
            overwrite: "auto",
          });
        };

        const stackCards = () => {
          const offsets = getStackOffsets();
          gsap.to(featureCards, {
            x: (index) => offsets[index],
            y: (index) => verticalOffsets[index],
            rotation: (index) => rotations[index],
            duration: 1.05,
            stagger: { each: 0.025, from: "center" },
            ease: "power4.inOut",
            overwrite: "auto",
          });
        };

        const syncStackOnResize = () => {
          if (featureSection.matches(":hover")) expandCards();
          else setStack();
        };

        setStack();
        featureSection.addEventListener("pointerenter", expandCards);
        featureSection.addEventListener("pointerleave", stackCards);
        window.addEventListener("resize", syncStackOnResize);

        return () => {
          featureSection.removeEventListener("pointerenter", expandCards);
          featureSection.removeEventListener("pointerleave", stackCards);
          window.removeEventListener("resize", syncStackOnResize);
          gsap.killTweensOf(featureCards);
          gsap.set(featureCards, { clearProps: "transform,zIndex" });
        };
      });
    }

    gsap.from(".landing-recipe-carousel-shell", {
      y: 54,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: ".landing-recipe-carousel-shell", start: "top 86%", once: true },
    });

    gsap.from(".landing-recipe-filters", {
      y: 24,
      opacity: 0,
      duration: 0.72,
      ease: "power3.out",
      scrollTrigger: { trigger: ".landing-recipe-filters", start: "top 92%", once: true },
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
    return () => featureMotion.revert();
  }, { scope: pageRef });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const direction = recipeDirectionRef.current;
    const cards = recipeCarouselRef.current?.querySelectorAll<HTMLElement>(".landing-recipe-card");
    const featuredImage = recipeCarouselRef.current?.querySelector<HTMLElement>(".landing-recipe-spotlight .landing-recipe-media img");
    if (!cards?.length || !featuredImage) return;

    gsap.fromTo(cards,
      { x: direction * 34, opacity: 0.35, scale: 0.975 },
      { x: 0, opacity: 1, scale: 1, duration: 0.72, stagger: 0.045, ease: "power3.out" },
    );
    gsap.fromTo(featuredImage,
      { scale: 1.075 },
      { scale: 1, duration: 1.05, ease: "power3.out" },
    );
  }, { scope: recipeCarouselRef, dependencies: [featuredRecipeIndex], revertOnUpdate: true });

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
          <div className="landing-feature-grid">{features.map(({ icon: Icon, title, copy, href }, index) => <div className="landing-feature-card-shell" key={title}><article><span className={`tone-${index + 1}`}><Icon /></span><div><h3>{title}</h3><p>{copy}</p></div><a href={href} aria-label={`Khám phá ${title}`}><ArrowRight /></a></article></div>)}</div>
        </div>
      </section>

      <section className="landing-section landing-recipes" id="recipes">
        <div className="landing-container">
          <div className="landing-recipe-heading">
            <div>
              <span className="landing-recipe-eyebrow"><Leaf /> Công thức ngon <i /> Dễ làm</span>
              <h2>Công thức nổi bật <Leaf aria-hidden="true" /></h2>
              <p>Khám phá những món ăn ngon, dễ làm và tốt cho sức khỏe được Nouri tuyển chọn mỗi ngày.</p>
            </div>
            <Link className="landing-recipe-all" to={appLink}>Xem tất cả công thức <ArrowRight /></Link>
          </div>

          <div className="landing-recipe-carousel-shell">
            <button className="landing-recipe-control previous" type="button" onClick={() => moveRecipe(-1)} aria-label="Xem công thức trước"><ArrowLeft /></button>
            <div className="landing-recipe-carousel" ref={recipeCarouselRef} aria-live="polite">
              <article className="landing-recipe-card landing-recipe-preview preview-left">
                <div className="landing-recipe-media">
                  <img src={previousRecipe.image} alt={previousRecipe.name} />
                  <button type="button" aria-label={`Lưu ${previousRecipe.name}`}><Bookmark /></button>
                </div>
                <div className="landing-recipe-preview-copy">
                  <h3>{previousRecipe.name}</h3>
                  <p><Clock3 /> {previousRecipe.time}<i /> <ChefHat /> {previousRecipe.level}</p>
                </div>
              </article>

              <article className="landing-recipe-card landing-recipe-spotlight">
                <div className="landing-recipe-media">
                  <img src={featuredRecipe.image} alt={featuredRecipe.name} />
                  <span className="landing-featured-badge"><Star /> Nổi bật</span>
                  <button type="button" aria-label={`Lưu ${featuredRecipe.name}`}><Bookmark /></button>
                </div>
                <div className="landing-recipe-spotlight-copy">
                  <div className="landing-recipe-tags">{featuredRecipe.tags.map((tag) => <span key={tag}><Leaf /> {tag}</span>)}</div>
                  <h3>{featuredRecipe.name}</h3>
                  <p>{featuredRecipe.description}</p>
                  <footer>
                    <div><span><Clock3 /> {featuredRecipe.time}</span><i /><span><ChefHat /> {featuredRecipe.level}</span><i /><span><UsersRound /> {featuredRecipe.servings}</span></div>
                    <Link to={appLink} aria-label={`Xem công thức ${featuredRecipe.name}`}><ArrowRight /></Link>
                  </footer>
                </div>
              </article>

              <article className="landing-recipe-card landing-recipe-preview preview-right">
                <div className="landing-recipe-media">
                  <img src={nextRecipe.image} alt={nextRecipe.name} />
                  <button type="button" aria-label={`Lưu ${nextRecipe.name}`}><Bookmark /></button>
                </div>
                <div className="landing-recipe-preview-copy">
                  <h3>{nextRecipe.name}</h3>
                  <p><Clock3 /> {nextRecipe.time}<i /> <ChefHat /> {nextRecipe.level}</p>
                </div>
              </article>
            </div>
            <button className="landing-recipe-control next" type="button" onClick={() => moveRecipe(1)} aria-label="Xem công thức tiếp theo"><ArrowRight /></button>
          </div>

          <div className="landing-recipe-dots" aria-label="Chọn công thức nổi bật">
            {recipes.map((recipe, index) => <button className={index === featuredRecipeIndex ? "active" : ""} type="button" key={recipe.name} onClick={() => selectRecipeCategory("all", index)} aria-label={`Hiển thị ${recipe.name}`} aria-pressed={index === featuredRecipeIndex} />)}
          </div>

          <div className="landing-recipe-filters" aria-label="Lọc công thức theo danh mục">
            {recipeCategories.map(({ id, label, count, icon: Icon, recipeIndex }) => <button className={id === activeRecipeCategory ? "active" : ""} type="button" key={id} onClick={() => selectRecipeCategory(id, recipeIndex)} aria-pressed={id === activeRecipeCategory}><span><Icon /></span><span><strong>{label}</strong><small>{count} món</small></span></button>)}
          </div>
        </div>
      </section>

      <section className="landing-trusted" aria-label="Thương hiệu tin dùng">
        <div className="landing-container"><span>Được tin dùng bởi</span><div className="landing-brand-row"><b>THANH NIÊN</b><b>FOODY</b><b>aFamily</b><b>VNEXPRESS</b><b>CAFEF</b><b>GENK</b></div></div>
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
