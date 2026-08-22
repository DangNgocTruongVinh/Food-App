import {
  ArrowLeft, ArrowRight, Bookmark, CalendarDays, Check, ChefHat, Clock3,
  BookOpen, Bot, CircleHelp, Dumbbell, Facebook, FileText, Flame, Grid2X2, Heart,
  HeartPulse, Instagram, Leaf, Lightbulb, Mail, Menu, MessageCircle, Play,
  Newspaper, Package, Salad, ShieldCheck, Sparkles, Star, Sunrise,
  Target, TrendingUp, Trophy, UserRound, UsersRound, Utensils, X,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";

gsap.registerPlugin(ScrollTrigger, Flip, useGSAP);

const features = [
  { icon: CalendarDays, title: "Lên thực đơn thông minh", copy: "Tạo thực đơn theo nhu cầu, sở thích và mục tiêu sức khỏe.", href: "#plan", image: "/assets/feature-meal-plan.png" },
  { icon: Utensils, title: "Công thức đa dạng", copy: "Hàng ngàn công thức ngon, dễ làm và giàu dinh dưỡng.", href: "#recipes", image: "/assets/feature-recipes.png" },
  { icon: HeartPulse, title: "Theo dõi dinh dưỡng", copy: "Kiểm soát calo và dưỡng chất dễ dàng mỗi ngày.", href: "#plan", image: "/assets/feature-nutrition.png" },
  { icon: UsersRound, title: "Cộng đồng truyền cảm hứng", copy: "Chia sẻ món ngon, mẹo hay và hành trình lành mạnh.", href: "#community", image: "/assets/feature-community.png" },
];

const recipes = [
  { image: "/assets/recipe-vegan-bowl.jpg", name: "Salad ức gà sốt chanh dây", description: "Ức gà mềm mọng cùng rau xanh và sốt chanh dây thanh nhẹ, giàu đạm nhưng vẫn tươi mát.", tags: ["Giàu protein", "Eat clean"], time: "20 phút", level: "Dễ", servings: "2 phần" },
  { image: "/assets/recipe-salmon.jpg", name: "Cá hồi áp chảo sốt bơ tỏi", description: "Cá hồi áp chảo vàng cạnh, kết hợp sốt bơ tỏi thơm dịu và rau củ nướng cân bằng.", tags: ["Giàu protein", "Ít carb"], time: "25 phút", level: "Trung bình", servings: "2 phần" },
  { image: "/assets/nutrition-hero.jpg", name: "Bowl quinoa rau củ nướng", description: "Quinoa bùi nhẹ, rau củ theo mùa và quả bơ tạo nên một bữa ăn nhiều chất xơ, đủ năng lượng.", tags: ["Nhiều chất xơ", "Eat clean"], time: "30 phút", level: "Dễ", servings: "2 phần" },
  { image: "/assets/recipe-oats.jpg", name: "Yến mạch trái cây bổ dưỡng", description: "Yến mạch mềm mịn với trái cây, hạt rang và sữa chua cho bữa sáng nhẹ nhàng, no lâu.", tags: ["Bữa sáng", "Thuần chay"], time: "15 phút", level: "Dễ", servings: "1 phần" },
];

type RecipeSlide = {
  id: number;
  position: number;
  recipeIndex: number;
};

const wrapRecipeIndex = (index: number) => (index + recipes.length) % recipes.length;
const createRecipeSlides = (activeIndex: number): RecipeSlide[] => [-2, -1, 0, 1, 2].map((position, id) => ({
  id,
  position,
  recipeIndex: wrapRecipeIndex(activeIndex + position),
}));
const getRecipePositionClass = (position: number) => position < 0 ? `position-minus-${Math.abs(position)}` : `position-${position}`;

const recipeCategories = [
  { id: "all", label: "Tất cả", count: 245, icon: Grid2X2, recipeIndex: 1 },
  { id: "weight-loss", label: "Giảm cân", count: 56, icon: Leaf, recipeIndex: 2 },
  { id: "protein", label: "Giàu protein", count: 48, icon: Dumbbell, recipeIndex: 1 },
  { id: "eat-clean", label: "Eat clean", count: 62, icon: Salad, recipeIndex: 0 },
  { id: "vegan", label: "Thuần chay", count: 40, icon: Leaf, recipeIndex: 2 },
  { id: "breakfast", label: "Bữa sáng", count: 38, icon: Sunrise, recipeIndex: 3 },
];

const landingNavItems = [
  { id: "home", label: "Trang chủ" },
  { id: "recipes", label: "Công thức" },
  { id: "plan", label: "Kế hoạch ăn uống" },
  { id: "community", label: "Cộng đồng" },
  { id: "about", label: "Về Nouri" },
] as const;

type LandingNavSection = (typeof landingNavItems)[number]["id"];

const communityHighlights = [
  { icon: UsersRound, title: "Chia sẻ hành trình", copy: "Đăng nhật ký, chia sẻ bữa ăn và hành trình cải thiện sức khỏe của bạn.", image: "/assets/community-card-journey.png" },
  { icon: Leaf, title: "Nhận cảm hứng", copy: "Khám phá câu chuyện, công thức và thói quen lành mạnh từ mọi người.", image: "/assets/community-card-inspiration.png" },
  { icon: MessageCircle, title: "Hỏi & Đáp", copy: "Đặt câu hỏi và nhận lời khuyên hữu ích từ cộng đồng và chuyên gia.", image: "/assets/community-card-qa.png" },
  { icon: Trophy, title: "Thử thách & Sự kiện", copy: "Tham gia thử thách, sự kiện thú vị để cùng nhau tiến bộ mỗi ngày.", image: "/assets/community-card-event.png" },
];

const footerGroups = [
  {
    title: "Khám phá",
    links: [
      { label: "Kho thực phẩm", href: "/pantry", icon: Package },
      { label: "Thực đơn", href: "/meal-plans", icon: CalendarDays },
      { label: "Công thức", href: "/recipes", icon: Utensils },
      { label: "Trợ lý AI", href: "/assistant", icon: Sparkles },
    ],
  },
  {
    title: "Nouri",
    links: [
      { label: "Về chúng tôi", href: "#about", icon: UserRound },
      { label: "Cộng đồng", href: "/community", icon: UsersRound },
      { label: "Tin tức", href: "#community", icon: Newspaper },
      { label: "Liên hệ", href: "mailto:hello@nouri.vn", icon: Mail },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Trung tâm trợ giúp", href: "/assistant", icon: CircleHelp },
      { label: "Hướng dẫn sử dụng", href: "/dashboard", icon: BookOpen },
      { label: "Chính sách bảo mật", href: "/privacy", icon: ShieldCheck },
      { label: "Điều khoản sử dụng", href: "/terms", icon: FileText },
    ],
  },
];

function FooterBotanical({ side }: { side: "left" | "right" }) {
  return <svg className={`landing-footer-botanical botanical-${side}`} viewBox="0 0 180 220" fill="none" aria-hidden="true">
    <path className="botanical-stem" d="M18 218C35 176 58 145 78 112C99 78 116 44 125 7" />
    <path className="botanical-stem botanical-stem-soft" d="M48 160C33 145 22 130 16 110M68 128C88 117 101 103 110 87M86 97C72 79 66 62 64 45M106 61C124 53 139 41 150 27" />
    <path className="botanical-leaf leaf-a" d="M20 111C2 112-5 96 2 75C21 80 31 94 20 111Z" />
    <path className="botanical-leaf leaf-b" d="M50 158C32 156 24 141 31 121C51 127 62 143 50 158Z" />
    <path className="botanical-leaf leaf-c" d="M66 128C73 108 89 101 108 106C102 126 86 137 66 128Z" />
    <path className="botanical-leaf leaf-d" d="M85 98C67 91 60 75 66 55C85 62 95 78 85 98Z" />
    <path className="botanical-leaf leaf-e" d="M107 62C113 43 129 34 148 38C143 57 127 68 107 62Z" />
    <path className="botanical-leaf leaf-f" d="M124 34C110 24 109 10 122 0C136 11 136 24 124 34Z" />
    <circle className="botanical-dot" cx="18" cy="57" r="2.4" />
    <circle className="botanical-dot" cx="151" cy="76" r="1.8" />
    <circle className="botanical-dot" cx="11" cy="137" r="1.6" />
    <circle className="botanical-dot" cx="157" cy="52" r="1.2" />
  </svg>;
}

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<LandingNavSection>("home");
  const [featuredRecipeIndex, setFeaturedRecipeIndex] = useState(1);
  const [activeRecipeCategory, setActiveRecipeCategory] = useState("all");
  const [recipeSlides, setRecipeSlides] = useState<RecipeSlide[]>(() => createRecipeSlides(1));
  const [isRecipeAnimating, setIsRecipeAnimating] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const landingNavRef = useRef<HTMLElement>(null);
  const landingNavIndicatorRef = useRef<HTMLSpanElement>(null);
  const navIndicatorReadyRef = useRef(false);
  const recipeCarouselRef = useRef<HTMLDivElement>(null);
  const activeRecipeIndexRef = useRef(1);
  const recipeAnimationRef = useRef(false);
  const recipeFlipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const recipeStepRef = useRef<{ nextIndex: number; direction: -1 | 1 } | null>(null);
  const pendingRecipeTargetRef = useRef<{ index: number } | null>(null);
  const recipeContinuationFrameRef = useRef<number | null>(null);
  const appLink = user ? "/dashboard" : "/login";

  const getDirectionToRecipe = (fromIndex: number, targetIndex: number): -1 | 1 => {
    const forwardDistance = wrapRecipeIndex(targetIndex - fromIndex);
    const backwardDistance = wrapRecipeIndex(fromIndex - targetIndex);
    return forwardDistance <= backwardDistance ? 1 : -1;
  };

  const runRecipeStep = (direction: -1 | 1) => {
    if (recipeAnimationRef.current) return;

    const carousel = recipeCarouselRef.current;
    const motionTargets = carousel?.querySelectorAll<HTMLElement>(
      ".landing-recipe-slide, .landing-recipe-media",
    );
    if (!carousel || !motionTargets?.length) return;

    const nextIndex = wrapRecipeIndex(activeRecipeIndexRef.current + direction);
    recipeAnimationRef.current = true;
    setIsRecipeAnimating(true);
    recipeStepRef.current = { nextIndex, direction };
    recipeFlipStateRef.current = Flip.getState(motionTargets, {
      props: "borderRadius,boxShadow,opacity",
    });
    setRecipeSlides((slides) => slides.map((slide) => ({
      ...slide,
      position: slide.position - direction,
    })));
  };

  const requestRecipe = (targetIndex: number, categoryId: string) => {
    if (recipeAnimationRef.current) return;

    const normalizedTarget = wrapRecipeIndex(targetIndex);
    setActiveRecipeCategory(categoryId);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      activeRecipeIndexRef.current = normalizedTarget;
      setFeaturedRecipeIndex(normalizedTarget);
      setRecipeSlides(createRecipeSlides(normalizedTarget));
      return;
    }

    if (normalizedTarget === activeRecipeIndexRef.current) return;
    pendingRecipeTargetRef.current = { index: normalizedTarget };
    runRecipeStep(getDirectionToRecipe(activeRecipeIndexRef.current, normalizedTarget));
  };

  const moveRecipe = (direction: -1 | 1) => {
    requestRecipe(activeRecipeIndexRef.current + direction, "all");
  };

  const selectRecipeCategory = (categoryId: string, recipeIndex: number) => {
    requestRecipe(recipeIndex, categoryId);
  };

  useEffect(() => () => {
    if (recipeContinuationFrameRef.current !== null) cancelAnimationFrame(recipeContinuationFrameRef.current);
  }, []);

  useEffect(() => {
    let frameId: number | null = null;

    const syncActiveSection = () => {
      frameId = null;
      const probeLine = Math.min(window.innerHeight * 0.32, 260);
      let nextSection: LandingNavSection = "home";

      landingNavItems.forEach(({ id }) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= probeLine) nextSection = id;
      });

      const isAtPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (isAtPageEnd) nextSection = "about";

      setActiveNavSection((current) => current === nextSection ? current : nextSection);
    };

    const scheduleSync = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(syncActiveSection);
    };

    syncActiveSection();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useGSAP(() => {
    const nav = landingNavRef.current;
    const indicator = landingNavIndicatorRef.current;
    if (!nav || !indicator) return;

    let frameId: number | null = null;
    const positionIndicator = () => {
      frameId = null;
      const activeLink = nav.querySelector<HTMLElement>(`[data-nav-section="${activeNavSection}"]`);
      if (!activeLink || activeLink.offsetParent === null) return;

      const navRect = nav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const properties = {
        x: linkRect.left - navRect.left,
        y: linkRect.top - navRect.top,
        width: linkRect.width,
        height: linkRect.height,
        autoAlpha: 1,
      };
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!navIndicatorReadyRef.current || reduceMotion) {
        gsap.set(indicator, properties);
        navIndicatorReadyRef.current = true;
        return;
      }

      gsap.to(indicator, {
        ...properties,
        duration: 0.48,
        ease: "power3.out",
        overwrite: "auto",
      });
    };
    const schedulePosition = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(positionIndicator);
    };

    schedulePosition();
    window.addEventListener("resize", schedulePosition);

    return () => {
      window.removeEventListener("resize", schedulePosition);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      gsap.killTweensOf(indicator);
    };
  }, { scope: landingNavRef, dependencies: [activeNavSection, menuOpen] });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const heroMotion = gsap.matchMedia();
    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".landing-header-inner", { y: -28, opacity: 0, duration: 0.8 })
      .from(".landing-hero-copy > *", { y: 24, opacity: 0, duration: 0.56, stagger: 0.065 }, "-=0.45")
      .from(".landing-hero-flow path", { strokeDashoffset: 170, opacity: 0, duration: 0.62, stagger: 0.055 }, "-=0.5")
      .from(".landing-hero-ingredient-layer", { x: -38, y: 18, opacity: 0, duration: 0.72 }, "-=0.58")
      .from(".landing-hero-ingredient", { scale: 0.92, rotation: -1.8, duration: 0.72 }, "<")
      .from(".landing-hero-bowl-layer", { scale: 0.84, rotation: -3.2, opacity: 0, duration: 0.82 }, "-=0.52")
      .from(".landing-hero-tableware-layer", { x: 24, y: 10, opacity: 0, duration: 0.68 }, "-=0.56");

    gsap.to(".landing-hero-ingredients", { y: -7, duration: 4.2, delay: 1.15, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".landing-hero-bowl", { y: -4, duration: 4.8, delay: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".landing-hero-bowl-aura", { rotation: 360, duration: 34, repeat: -1, ease: "none", transformOrigin: "50% 50%" });
    gsap.to(".landing-hero-flow path", { strokeDashoffset: -120, duration: 7.5, repeat: -1, ease: "none", stagger: 0.28 });

    const heroVisual = pageRef.current?.querySelector<HTMLElement>(".landing-hero-visual");
    if (heroVisual) {
      heroMotion.add("(hover: hover) and (min-width: 961px)", () => {
        const parallaxLayers = gsap.utils.toArray<HTMLElement>(".landing-hero-parallax-layer");
        const heroIngredients = heroVisual.querySelector<HTMLElement>(".landing-hero-ingredient");
        const heroBowl = heroVisual.querySelector<HTMLElement>(".landing-hero-bowl");
        const primaryCta = pageRef.current?.querySelector<HTMLElement>(".landing-primary-button");
        const secondaryCta = pageRef.current?.querySelector<HTMLElement>(".landing-hero-watch");
        const handlePointerMove = (event: PointerEvent) => {
          const bounds = heroVisual.getBoundingClientRect();
          const xRatio = (event.clientX - bounds.left) / bounds.width - 0.5;
          const yRatio = (event.clientY - bounds.top) / bounds.height - 0.5;

          parallaxLayers.forEach((layer) => {
            const depth = Number(layer.dataset.depth ?? 1);
            gsap.to(layer, {
              x: xRatio * depth * 8,
              y: yRatio * depth * 6,
              duration: 0.72,
              ease: "power3.out",
              overwrite: "auto",
            });
          });
        };
        const engageVisual = () => {
          heroVisual.classList.add("is-engaged");
          if (heroIngredients) gsap.to(heroIngredients, { scale: 1.022, rotation: -0.45, duration: 0.76, ease: "power3.out", overwrite: "auto" });
          if (heroBowl) gsap.to(heroBowl, { scale: 1.016, duration: 0.76, ease: "power3.out", overwrite: "auto" });
        };
        const resetParallax = () => {
          heroVisual.classList.remove("is-engaged");
          gsap.to(parallaxLayers, { x: 0, y: 0, duration: 0.9, ease: "power3.out", overwrite: "auto" });
          if (heroIngredients) gsap.to(heroIngredients, { scale: 1, rotation: 0, duration: 0.82, ease: "power3.out", overwrite: "auto" });
          if (heroBowl) gsap.to(heroBowl, { scale: 1, duration: 0.82, ease: "power3.out", overwrite: "auto" });
        };

        const attachMagnet = (element: HTMLElement | null | undefined, accentSelector: string) => {
          if (!element) return undefined;
          const accent = element.querySelector<HTMLElement>(accentSelector);
          const move = (event: PointerEvent) => {
            const bounds = element.getBoundingClientRect();
            const offsetX = event.clientX - (bounds.left + bounds.width / 2);
            const offsetY = event.clientY - (bounds.top + bounds.height / 2);
            gsap.to(element, { x: offsetX * 0.055, y: offsetY * 0.08, duration: 0.38, ease: "power3.out", overwrite: "auto" });
            if (accent) gsap.to(accent, { x: offsetX * 0.1, y: offsetY * 0.08, rotation: offsetX * -0.035, duration: 0.38, ease: "power3.out", overwrite: "auto" });
          };
          const leave = () => {
            gsap.to(element, { x: 0, y: 0, duration: 0.65, ease: "power3.out", overwrite: "auto" });
            if (accent) gsap.to(accent, { x: 0, y: 0, rotation: 0, duration: 0.65, ease: "power3.out", overwrite: "auto" });
          };
          element.addEventListener("pointermove", move);
          element.addEventListener("pointerleave", leave);
          return () => {
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerleave", leave);
            gsap.killTweensOf([element, accent]);
            gsap.set([element, accent], { clearProps: "transform" });
          };
        };

        const detachPrimaryMagnet = attachMagnet(primaryCta, ".landing-primary-arrow");
        const detachSecondaryMagnet = attachMagnet(secondaryCta, "span");

        heroVisual.addEventListener("pointermove", handlePointerMove);
        heroVisual.addEventListener("pointerenter", engageVisual);
        heroVisual.addEventListener("pointerleave", resetParallax);

        return () => {
          heroVisual.removeEventListener("pointermove", handlePointerMove);
          heroVisual.removeEventListener("pointerenter", engageVisual);
          heroVisual.removeEventListener("pointerleave", resetParallax);
          detachPrimaryMagnet?.();
          detachSecondaryMagnet?.();
          gsap.killTweensOf(parallaxLayers);
          gsap.killTweensOf([heroIngredients, heroBowl]);
          gsap.set(parallaxLayers, { clearProps: "transform" });
        };
      });
    }
    gsap.utils.toArray<HTMLElement>(".landing-feature-intro, .landing-recipe-heading, .landing-section-heading").forEach((element) => {
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

    const featureDeck = pageRef.current?.querySelector<HTMLElement>(".landing-feature-deck");
    const featureGrid = pageRef.current?.querySelector<HTMLElement>(".landing-feature-grid");
    const featureCards = gsap.utils.toArray<HTMLElement>(".landing-feature-card-shell");
    const featureMotion = gsap.matchMedia();

    if (featureDeck && featureGrid && featureCards.length === 4) {
      featureMotion.add("(hover: hover) and (min-width: 721px)", () => {
        let collapseTimer: number | undefined;
        let isExpanded = false;

        const getStackLayout = () => {
          const isTablet = window.innerWidth <= 960;
          const rotations = isTablet ? [-2.4, -0.7, 0.6, 2.2] : [-3.2, -0.9, 0.8, 3];
          const verticalOffsets = isTablet ? [9, 2, 2, 9] : [12, 3, 3, 12];
          const stackStep = isTablet
            ? Math.min(104, Math.max(86, featureGrid.clientWidth * 0.105))
            : Math.min(154, Math.max(128, featureGrid.clientWidth * 0.108));
          const gridCenter = featureGrid.clientWidth / 2;

          return featureCards.map((card, index) => ({
            x: gridCenter + (index - 1.5) * stackStep - (card.offsetLeft + card.offsetWidth / 2),
            y: verticalOffsets[index],
            rotation: rotations[index],
          }));
        };

        const setStack = () => {
          const stackLayout = getStackLayout();
          featureDeck.classList.remove("is-expanded");
          gsap.set(featureCards, {
            x: (index) => stackLayout[index].x,
            y: (index) => stackLayout[index].y,
            rotation: (index) => stackLayout[index].rotation,
            transformOrigin: "50% 50%",
            zIndex: (index) => index + 1,
          });
        };

        const expandCards = () => {
          if (collapseTimer !== undefined) window.clearTimeout(collapseTimer);
          if (isExpanded) return;
          isExpanded = true;
          featureDeck.classList.add("is-expanded");
          gsap.to(featureCards, {
            x: 0,
            y: 0,
            rotation: 0,
            zIndex: 2,
            duration: 0.82,
            stagger: { each: 0.028, from: "center" },
            ease: "power3.inOut",
            overwrite: "auto",
          });
        };

        const collapseCards = () => {
          if (collapseTimer !== undefined) window.clearTimeout(collapseTimer);
          collapseTimer = window.setTimeout(() => {
            const stackLayout = getStackLayout();
            isExpanded = false;
            featureDeck.classList.remove("is-expanded");
            gsap.to(featureCards, {
              x: (index) => stackLayout[index].x,
              y: (index) => stackLayout[index].y,
              rotation: (index) => stackLayout[index].rotation,
              zIndex: (index) => index + 1,
              duration: 0.86,
              stagger: { each: 0.024, from: "edges" },
              ease: "power3.inOut",
              overwrite: "auto",
            });
          }, 160);
        };

        const syncStackOnResize = () => {
          if (isExpanded) gsap.set(featureCards, { x: 0, y: 0, rotation: 0, zIndex: 2 });
          else setStack();
        };

        setStack();
        featureDeck.addEventListener("pointerenter", expandCards);
        featureDeck.addEventListener("pointerleave", collapseCards);
        featureDeck.addEventListener("focusin", expandCards);
        featureDeck.addEventListener("focusout", collapseCards);
        window.addEventListener("resize", syncStackOnResize);

        return () => {
          if (collapseTimer !== undefined) window.clearTimeout(collapseTimer);
          featureDeck.removeEventListener("pointerenter", expandCards);
          featureDeck.removeEventListener("pointerleave", collapseCards);
          featureDeck.removeEventListener("focusin", expandCards);
          featureDeck.removeEventListener("focusout", collapseCards);
          window.removeEventListener("resize", syncStackOnResize);
          featureDeck.classList.remove("is-expanded");
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

    const planReveal = gsap.timeline({
      scrollTrigger: {
        trigger: ".landing-plan-card",
        start: "top 76%",
        once: true,
      },
    });
    planReveal
      .from(".landing-plan-phone-wrap", { y: 64, scale: 0.86, opacity: 0, duration: 0.92, ease: "power3.out" })
      .from(".landing-plan-note", {
        y: 24,
        scale: 0.9,
        opacity: 0,
        duration: 0.58,
        stagger: 0.075,
        ease: "back.out(1.18)",
      }, "-=0.46")
      .to(".landing-plan-connections path", {
        strokeDashoffset: 0,
        duration: 0.7,
        stagger: 0.055,
        ease: "power2.out",
      }, "-=0.58")
      .from(".landing-plan-copy > *", {
        y: 22,
        opacity: 0,
        duration: 0.58,
        stagger: 0.07,
        ease: "power3.out",
      }, "-=0.82");

    gsap.to(".landing-mascot-head", {
      y: -4,
      rotation: 2,
      duration: 2.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      scrollTrigger: {
        trigger: ".landing-plan-card",
        start: "top 82%",
        end: "bottom top",
        toggleActions: "play pause resume pause",
      },
    });

    const communityReveal = gsap.timeline({
      scrollTrigger: {
        trigger: ".landing-community-shell",
        start: "top 78%",
        once: true,
      },
    });
    communityReveal
      .from(".landing-community-copy > *", {
        y: 26,
        opacity: 0,
        duration: 0.62,
        stagger: 0.075,
        ease: "power3.out",
      })
      .from(".landing-community-photo-main", { y: 36, scale: 0.86, opacity: 0, duration: 0.84, ease: "power3.out" }, "-=0.46")
      .from(".landing-community-photo-yoga", { x: 52, y: -20, opacity: 0, duration: 0.7, ease: "power3.out" }, "-=0.5")
      .from(".landing-community-photo-smoothie", { x: 42, y: 26, opacity: 0, duration: 0.7, ease: "power3.out" }, "-=0.52")
      .from(".landing-community-float", {
        y: 20,
        scale: 0.92,
        opacity: 0,
        duration: 0.52,
        stagger: 0.085,
        ease: "back.out(1.14)",
      }, "-=0.48")
      .from(".landing-community-feature", {
        y: 30,
        opacity: 0,
        duration: 0.58,
        stagger: 0.07,
        ease: "power3.out",
      }, "-=0.3");

    const communityFeatureGrid = pageRef.current?.querySelector<HTMLElement>(".landing-community-feature-grid");
    const communityFeatureCards = gsap.utils.toArray<HTMLElement>(".landing-community-feature");
    const communityFeatureMotion = gsap.matchMedia();

    if (communityFeatureGrid && communityFeatureCards.length === 4) {
      communityFeatureMotion.add("(hover: hover) and (min-width: 961px)", () => {
        let resetTimer: number | undefined;

        const resetCards = () => {
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          communityFeatureCards.forEach((card) => card.classList.remove("is-active"));
          gsap.to(communityFeatureCards, {
            flexGrow: 1,
            y: 0,
            duration: 0.62,
            ease: "power3.inOut",
            overwrite: "auto",
          });
          gsap.to(".landing-community-feature-media img", { scale: 1, duration: 0.72, ease: "power3.out", overwrite: "auto" });
          gsap.to(".landing-community-feature-icon", { scale: 1, rotation: 0, duration: 0.5, ease: "power3.out", overwrite: "auto" });
        };

        const activateCard = (activeCard: HTMLElement) => {
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          communityFeatureCards.forEach((card) => card.classList.toggle("is-active", card === activeCard));
          gsap.to(communityFeatureCards, {
            flexGrow: (index) => communityFeatureCards[index] === activeCard ? 1.48 : 0.84,
            y: (index) => communityFeatureCards[index] === activeCard ? -6 : 0,
            duration: 0.68,
            stagger: { each: 0.018, from: communityFeatureCards.indexOf(activeCard) },
            ease: "power3.out",
            overwrite: "auto",
          });
          const activeImage = activeCard.querySelector(".landing-community-feature-media img");
          const activeIcon = activeCard.querySelector(".landing-community-feature-icon");
          if (activeImage) gsap.to(activeImage, { scale: 1.055, duration: 0.82, ease: "power3.out", overwrite: "auto" });
          if (activeIcon) gsap.to(activeIcon, { scale: 1.06, rotation: -4, duration: 0.5, ease: "power3.out", overwrite: "auto" });
        };

        const pointerHandlers = communityFeatureCards.map((card) => {
          const handler = () => activateCard(card);
          card.addEventListener("pointerenter", handler);
          return { card, handler };
        });
        const handlePointerLeave = () => {
          resetTimer = window.setTimeout(resetCards, 110);
        };
        const handleFocusIn = (event: FocusEvent) => {
          const card = (event.target as HTMLElement).closest<HTMLElement>(".landing-community-feature");
          if (card) activateCard(card);
        };
        const handleFocusOut = (event: FocusEvent) => {
          if (!communityFeatureGrid.contains(event.relatedTarget as Node | null)) handlePointerLeave();
        };

        communityFeatureGrid.addEventListener("pointerleave", handlePointerLeave);
        communityFeatureGrid.addEventListener("focusin", handleFocusIn);
        communityFeatureGrid.addEventListener("focusout", handleFocusOut);

        return () => {
          if (resetTimer !== undefined) window.clearTimeout(resetTimer);
          pointerHandlers.forEach(({ card, handler }) => card.removeEventListener("pointerenter", handler));
          communityFeatureGrid.removeEventListener("pointerleave", handlePointerLeave);
          communityFeatureGrid.removeEventListener("focusin", handleFocusIn);
          communityFeatureGrid.removeEventListener("focusout", handleFocusOut);
          communityFeatureCards.forEach((card) => card.classList.remove("is-active"));
          gsap.killTweensOf(communityFeatureCards);
          gsap.set(communityFeatureCards, { clearProps: "flexGrow,transform" });
          gsap.set(".landing-community-feature-media img, .landing-community-feature-icon", { clearProps: "transform" });
        };
      });
    }

    const footerReveal = gsap.timeline({
      scrollTrigger: {
        trigger: ".landing-footer",
        start: "top 90%",
        once: true,
      },
    });
    footerReveal
      .from(".landing-footer-brand > *", {
        y: 24,
        opacity: 0,
        duration: 0.62,
        stagger: 0.07,
        ease: "power3.out",
      })
      .from(".landing-footer-group", {
        y: 30,
        opacity: 0,
        duration: 0.68,
        stagger: 0.09,
        ease: "power3.out",
      }, "-=0.38")
      .from(".landing-footer-botanical .botanical-leaf", {
        scale: 0.78,
        opacity: 0,
        duration: 0.78,
        stagger: 0.045,
        transformOrigin: "50% 100%",
        ease: "power2.out",
      }, "-=0.58");

    return () => {
      heroMotion.revert();
      featureMotion.revert();
      communityFeatureMotion.revert();
    };
  }, { scope: pageRef });

  useGSAP(() => {
    const flipState = recipeFlipStateRef.current;
    const completedStep = recipeStepRef.current;
    if (!flipState || !completedStep) return;

    recipeFlipStateRef.current = null;
    recipeStepRef.current = null;

    const carousel = recipeCarouselRef.current;
    if (!carousel) return;

    const { direction } = completedStep;
    const incomingCard = carousel.querySelector<HTMLElement>('[data-recipe-position="0"]');
    const outgoingCard = carousel.querySelector<HTMLElement>(`[data-recipe-position="${-direction}"]`);
    const incomingPreview = incomingCard?.querySelector<HTMLElement>(".landing-recipe-preview-copy");
    const incomingSpotlight = incomingCard?.querySelector<HTMLElement>(".landing-recipe-spotlight-copy");
    const outgoingPreview = outgoingCard?.querySelector<HTMLElement>(".landing-recipe-preview-copy");
    const outgoingSpotlight = outgoingCard?.querySelector<HTMLElement>(".landing-recipe-spotlight-copy");
    const incomingImage = incomingCard?.querySelector<HTMLElement>(".landing-recipe-media img");
    const outgoingImage = outgoingCard?.querySelector<HTMLElement>(".landing-recipe-media img");
    const incomingBadge = incomingCard?.querySelector<HTMLElement>(".landing-featured-badge");
    const outgoingBadge = outgoingCard?.querySelector<HTMLElement>(".landing-featured-badge");

    if (incomingPreview && incomingSpotlight) {
      gsap.set(incomingPreview, { autoAlpha: 1, y: 0 });
      gsap.set(incomingSpotlight, { autoAlpha: 0, y: 12 });
    }
    if (outgoingPreview && outgoingSpotlight) {
      gsap.set(outgoingPreview, { autoAlpha: 0, y: 9 });
      gsap.set(outgoingSpotlight, { autoAlpha: 1, y: 0 });
    }
    if (incomingBadge) gsap.set(incomingBadge, { autoAlpha: 0, y: -6, scale: 0.94 });
    if (outgoingBadge) gsap.set(outgoingBadge, { autoAlpha: 1, y: 0, scale: 1 });

    const transition = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        gsap.set(carousel.querySelectorAll(".landing-recipe-preview-copy, .landing-recipe-spotlight-copy, .landing-recipe-media img, .landing-featured-badge"), {
          clearProps: "opacity,visibility,transform",
        });
        const { nextIndex } = completedStep;
        activeRecipeIndexRef.current = nextIndex;
        setFeaturedRecipeIndex(nextIndex);
        setRecipeSlides((slides) => slides.map((slide) => {
          if (slide.position < -2) return { ...slide, position: 2, recipeIndex: wrapRecipeIndex(nextIndex + 2) };
          if (slide.position > 2) return { ...slide, position: -2, recipeIndex: wrapRecipeIndex(nextIndex - 2) };
          return slide;
        }));

        recipeAnimationRef.current = false;
        const pendingTarget = pendingRecipeTargetRef.current;
        if (pendingTarget && pendingTarget.index !== nextIndex) {
          recipeContinuationFrameRef.current = requestAnimationFrame(() => {
            recipeContinuationFrameRef.current = requestAnimationFrame(() => {
              runRecipeStep(getDirectionToRecipe(nextIndex, pendingTarget.index));
            });
          });
          return;
        }

        pendingRecipeTargetRef.current = null;
        setIsRecipeAnimating(false);
      },
    });

    transition.add(Flip.from(flipState, {
      duration: 0.84,
      ease: "power3.inOut",
      nested: true,
      scale: false,
      prune: true,
    }), 0);

    if (incomingPreview && incomingSpotlight) {
      transition
        .to(incomingPreview, { autoAlpha: 0, y: -6, duration: 0.2, ease: "power2.in" }, 0.08)
        .to(incomingSpotlight, { autoAlpha: 1, y: 0, duration: 0.34, ease: "power2.out" }, 0.35);
    }
    if (outgoingPreview && outgoingSpotlight) {
      transition
        .to(outgoingSpotlight, { autoAlpha: 0, y: -6, duration: 0.2, ease: "power2.in" }, 0.06)
        .to(outgoingPreview, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" }, 0.32);
    }
    if (incomingImage) {
      transition.fromTo(incomingImage,
        { scale: 1.025, xPercent: direction * 1.4 },
        { scale: 1, xPercent: 0, duration: 0.76, ease: "power2.out" },
        0.04,
      );
    }
    if (outgoingImage) {
      transition.fromTo(outgoingImage,
        { scale: 1, xPercent: 0 },
        { scale: 1.012, xPercent: direction * -0.8, duration: 0.72, ease: "power2.inOut" },
        0,
      );
    }
    if (incomingBadge) {
      transition.to(incomingBadge, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: "power2.out" }, 0.42);
    }
    if (outgoingBadge) {
      transition.to(outgoingBadge, { autoAlpha: 0, y: -5, scale: 0.96, duration: 0.18, ease: "power2.in" }, 0.06);
    }

    return () => transition.kill();
  }, { scope: recipeCarouselRef, dependencies: [recipeSlides] });

  return <div className="landing-page" ref={pageRef}>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link
          to="/#home"
          className="landing-brand"
          aria-label="Nouri - Trang chủ"
          onClick={() => {
            setActiveNavSection("home");
            setMenuOpen(false);
            window.requestAnimationFrame(() => document.getElementById("home")?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
              block: "start",
            }));
          }}
        ><Logo /></Link>
        <nav className={menuOpen ? "landing-nav open" : "landing-nav"} aria-label="Điều hướng trang chủ" ref={landingNavRef}>
          <span className="landing-nav-indicator" ref={landingNavIndicatorRef} aria-hidden="true" />
          {landingNavItems.map(({ id, label }) => <a
            className={activeNavSection === id ? "active" : undefined}
            href={`#${id}`}
            data-nav-section={id}
            onClick={() => {
              setActiveNavSection(id);
              setMenuOpen(false);
            }}
            aria-current={activeNavSection === id ? "location" : undefined}
            key={id}
          >{label}</a>)}
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-login" to="/login">Đăng nhập</Link>
          <button className="landing-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero" id="home">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-hero-kicker"><Leaf aria-hidden="true" /> NOURI GIÚP BẠN <Leaf aria-hidden="true" /></span>
            <h1>Ăn ngon,<br />sống khỏe<br /><em>mỗi ngày</em></h1>
            <p>Nouri biến việc nấu ăn trở nên đơn giản hơn với công thức thông minh, kế hoạch cá nhân hóa và cộng đồng yêu bếp.</p>
            <div className="landing-hero-benefits" aria-label="Lợi ích nổi bật">
              <article><span><Salad /></span><div><strong>Công thức</strong><small>khoa học</small></div></article>
              <article><span><CalendarDays /></span><div><strong>Kế hoạch</strong><small>cá nhân hóa</small></div></article>
              <article><span><UsersRound /></span><div><strong>Cộng đồng</strong><small>yêu bếp</small></div></article>
            </div>
            <div className="landing-hero-actions">
              <Link className="landing-primary-button" to={appLink}><Sparkles className="landing-primary-sparkle" /><span>Bắt đầu ngay</span><span className="landing-primary-arrow"><ArrowRight /></span></Link>
              <a className="landing-hero-watch" href="#features"><span><Play /></span>Xem cách Nouri hoạt động</a>
            </div>
          </div>

          <div className="landing-hero-visual" aria-label="Nguyên liệu tươi tạo thành bowl cá hồi lành mạnh">
            <svg className="landing-hero-organic-background" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="landingHeroOrganicFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#edf3e9" />
                  <stop offset="0.5" stopColor="#dce8d7" />
                  <stop offset="1" stopColor="#cdddc8" />
                </linearGradient>
              </defs>
              <path className="landing-hero-organic-secondary" d="M300 0C235 50 145 85 92 150C48 214 65 280 120 346C174 411 157 474 91 540C37 598 65 644 170 674C320 716 452 638 594 670C750 705 872 744 1000 622L1000 0Z" />
              <path className="landing-hero-organic-primary" d="M330 0C270 56 180 82 130 145C78 210 86 272 145 338C202 403 187 462 120 528C62 586 84 635 192 666C338 708 465 629 606 657C764 689 875 734 1000 608L1000 0Z" />
              <path className="landing-hero-organic-contour" d="M330 0C270 56 180 82 130 145C78 210 86 272 145 338C202 403 187 462 120 528C62 586 84 635 192 666C338 708 465 629 606 657C764 689 875 734 1000 608" />
            </svg>
            <div className="landing-hero-orbit" aria-hidden="true" />
            <span className="landing-hero-bowl-aura" aria-hidden="true"><i /><i /><i /></span>
            <svg className="landing-hero-flow" viewBox="0 0 760 610" fill="none" aria-hidden="true">
              <path d="M92 318C196 321 263 320 358 321" />
              <path d="M239 124C332 140 374 193 426 258" />
              <path d="M351 506C413 465 455 430 489 378" />
            </svg>
            <div className="landing-hero-ingredient-layer landing-hero-parallax-layer" data-depth="1.8">
              <div className="landing-hero-ingredient landing-hero-ingredients" aria-hidden="true">
                <img className="landing-hero-composition-asset landing-hero-microgreens" src="/assets/hero-composition-microgreens.png" alt="" />
                <img className="landing-hero-composition-asset landing-hero-dressing" src="/assets/hero-composition-dressing.png" alt="" />
                <img className="landing-hero-composition-asset landing-hero-loose-leaves" src="/assets/hero-composition-leaves.png" alt="" />
                <img className="landing-hero-composition-asset landing-hero-spices" src="/assets/hero-composition-spices.png" alt="" />
                <img className="landing-hero-composition-asset landing-hero-leaf-accent-top" src="/assets/hero-composition-leaves.png" alt="" />
                <img className="landing-hero-composition-asset landing-hero-spice-accent-bottom" src="/assets/hero-composition-spices.png" alt="" />
              </div>
            </div>
            <div className="landing-hero-bowl-layer landing-hero-parallax-layer" data-depth="0.8">
              <img className="landing-hero-bowl" src="/assets/hero-composition-main-bowl.png" alt="Bowl cá hồi với quinoa, măng tây, quả bơ, đậu gà và rau xanh" />
              <img className="landing-hero-steam" src="/assets/hero-composition-steam.png" alt="" aria-hidden="true" />
            </div>
            <div className="landing-hero-tableware-layer landing-hero-parallax-layer" data-depth="1.15" aria-hidden="true">
              <img className="landing-hero-composition-asset landing-hero-napkin" src="/assets/hero-composition-tableware-v2.png" alt="" />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-features" id="features">
        <div className="landing-container">
          <div className="landing-feature-intro"><span>NOURI GIÚP BẠN <Leaf /></span><h2>Trải nghiệm nấu ăn đơn giản hơn, lành mạnh hơn và thú vị hơn.</h2></div>
          <div className="landing-feature-deck">
            <div className="landing-feature-grid">{features.map(({ icon: Icon, title, copy, href, image }, index) => <div className="landing-feature-card-shell" key={title}><article><div className="landing-feature-card-heading"><span className={`tone-${index + 1}`}><Icon /></span><h3>{title}</h3></div><p>{copy}</p><img className={`landing-feature-illustration illustration-${index + 1}`} src={image} alt="" loading="lazy" draggable="false" /><a href={href} aria-label={`Khám phá ${title}`}><ArrowRight /></a></article></div>)}</div>
          </div>
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
            <button className="landing-recipe-control previous" type="button" onClick={() => moveRecipe(-1)} aria-label="Xem công thức trước" disabled={isRecipeAnimating}><ArrowLeft /></button>
            <div className={`landing-recipe-carousel${isRecipeAnimating ? " is-transitioning" : ""}`} ref={recipeCarouselRef} aria-live="polite">
              {recipeSlides.map((slide) => {
                const recipe = recipes[slide.recipeIndex];
                const isSpotlight = slide.position === 0;
                const isPreviewLeft = slide.position < 0;
                const isOutside = Math.abs(slide.position) > 1;

                return <article
                  className={`landing-recipe-card landing-recipe-slide ${isSpotlight ? "landing-recipe-spotlight" : "landing-recipe-preview"} ${isPreviewLeft ? "preview-left" : "preview-right"} ${getRecipePositionClass(slide.position)}`}
                  data-recipe-position={slide.position}
                  aria-hidden={isOutside}
                  key={slide.id}
                >
                  <div className="landing-recipe-media">
                    <img src={recipe.image} alt={recipe.name} />
                    <span className="landing-featured-badge"><Star /> Nổi bật</span>
                    <button type="button" aria-label={`Lưu ${recipe.name}`} tabIndex={isOutside ? -1 : 0}><Bookmark /></button>
                  </div>
                  <div className="landing-recipe-copy-stage">
                    <div className="landing-recipe-preview-copy" aria-hidden={isSpotlight}>
                      <h3>{recipe.name}</h3>
                      <p><Clock3 /> {recipe.time}<i /> <ChefHat /> {recipe.level}</p>
                    </div>
                    <div className="landing-recipe-spotlight-copy" aria-hidden={!isSpotlight}>
                      <div className="landing-recipe-tags">{recipe.tags.map((tag) => <span key={tag}><Leaf /> {tag}</span>)}</div>
                      <h3>{recipe.name}</h3>
                      <p>{recipe.description}</p>
                      <footer>
                        <div><span><Clock3 /> {recipe.time}</span><i /><span><ChefHat /> {recipe.level}</span><i /><span><UsersRound /> {recipe.servings}</span></div>
                        <Link to={appLink} tabIndex={isSpotlight ? 0 : -1} aria-label={`Xem công thức ${recipe.name}`}><ArrowRight /></Link>
                      </footer>
                    </div>
                  </div>
                </article>;
              })}
            </div>
            <button className="landing-recipe-control next" type="button" onClick={() => moveRecipe(1)} aria-label="Xem công thức tiếp theo" disabled={isRecipeAnimating}><ArrowRight /></button>
          </div>

          <div className="landing-recipe-dots" aria-label="Chọn công thức nổi bật">
            {recipes.map((recipe, index) => <button className={index === featuredRecipeIndex ? "active" : ""} type="button" key={recipe.name} onClick={() => selectRecipeCategory("all", index)} aria-label={`Hiển thị ${recipe.name}`} aria-pressed={index === featuredRecipeIndex} disabled={isRecipeAnimating} />)}
          </div>

          <div className="landing-recipe-filters" aria-label="Lọc công thức theo danh mục">
            {recipeCategories.map(({ id, label, count, icon: Icon, recipeIndex }) => <button className={id === activeRecipeCategory ? "active" : ""} type="button" key={id} onClick={() => selectRecipeCategory(id, recipeIndex)} aria-pressed={id === activeRecipeCategory} disabled={isRecipeAnimating}><span><Icon /></span><span><strong>{label}</strong><small>{count} món</small></span></button>)}
          </div>
        </div>
      </section>

      <section className="landing-section landing-plan-section" id="plan">
        <div className="landing-container landing-plan-card">
          <div className="landing-plan-copy">
            <div className="landing-plan-mascot" aria-hidden="true">
              <div className="landing-mascot-head"><ChefHat /><span><Bot /></span></div>
              <div className="landing-mascot-tray"><Leaf /><Salad /></div>
              <Sparkles className="landing-mascot-sparkle" />
            </div>
            <h2>Kế hoạch ăn uống<br />được tạo riêng cho<br />bạn bởi <strong>AI.</strong></h2>
            <p>Nouri phân tích mục tiêu, thói quen và nhu cầu dinh dưỡng của bạn để tạo nên thực đơn phù hợp, khoa học và dễ thực hiện.</p>
            <ul>
              <li><span><Target /></span>Phù hợp mục tiêu cá nhân</li>
              <li><span><HeartPulse /></span>Cân bằng dinh dưỡng</li>
              <li><span><Clock3 /></span>Tiết kiệm thời gian</li>
            </ul>
            <div className="landing-plan-action">
              <Link to={appLink}>Tạo kế hoạch của tôi <ArrowRight /></Link>
              <span><Sparkles /> Dành riêng cho bạn</span>
            </div>
          </div>

          <div className="landing-plan-visual">
            <div className="landing-plan-organic-shape" aria-hidden="true" />
            <svg className="landing-plan-connections" viewBox="0 0 760 720" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength="1" d="M275 160 C330 160 326 215 365 236" />
              <path pathLength="1" d="M248 353 C303 350 312 370 357 378" />
              <path pathLength="1" d="M276 580 C325 565 329 520 365 503" />
              <path pathLength="1" d="M488 148 C438 157 442 216 411 236" />
              <path pathLength="1" d="M514 353 C462 350 454 374 414 381" />
              <path pathLength="1" d="M486 583 C441 565 443 524 410 506" />
            </svg>

            <div className="landing-plan-phone-wrap">
              <div className="landing-phone" aria-label="Xem trước kế hoạch ăn uống">
                <div className="landing-phone-notch" />
                <header><strong>Kế hoạch của bạn</strong><small>19 – 25 Tháng 5, 2025</small></header>
                <nav><b>T2<small>19</small></b><span>T3<small>20</small></span><span>T4<small>21</small></span><span>T5<small>22</small></span><span>T6<small>23</small></span><span>T7<small>24</small></span><span>CN<small>25</small></span></nav>
                <section>
                  <span>Bữa sáng <small>525 kcal</small></span>
                  <article><img src="/assets/recipe-oats.jpg" alt="" /><div><strong>Yến mạch trái cây & hạt</strong><small>1 khẩu phần</small></div></article>
                  <span>Bữa trưa <small>650 kcal</small></span>
                  <article><img src="/assets/recipe-salmon.jpg" alt="" /><div><strong>Cơm gạo lứt, cá áp chảo</strong><small>Khẩu phần cân bằng</small></div></article>
                  <span>Bữa tối <small>560 kcal</small></span>
                  <article><img src="/assets/recipe-vegan-bowl.jpg" alt="" /><div><strong>Salad ức gà sốt chanh dây</strong><small>1 khẩu phần</small></div></article>
                </section>
                <footer className="landing-phone-tabs"><span><CalendarDays />Kế hoạch</span><span><Utensils />Công thức</span><span><UsersRound />Cộng đồng</span></footer>
              </div>
            </div>

            <div className="landing-plan-notes">
              <article className="landing-plan-note note-goal"><i className="landing-note-clip" /><span><Target /></span><div><small>Mục tiêu của bạn</small><strong>Giảm cân</strong><em>-0.6 kg/tuần</em><b className="landing-note-bar"><i style={{ width: "69%" }} /></b></div></article>
              <article className="landing-plan-note note-energy"><span><Flame /></span><div><small>Năng lượng mỗi ngày</small><strong>1.650 kcal</strong><em>Đạt 80% mục tiêu</em><b className="landing-note-bar energy"><i style={{ width: "80%" }} /></b></div></article>
              <article className="landing-plan-note note-preference"><i className="landing-note-clip" /><span><Salad /></span><div><small>Ưu tiên của bạn</small><strong>Eat clean</strong><em>Ít dầu mỡ, nhiều rau xanh</em></div></article>
              <article className="landing-plan-note note-body"><span><HeartPulse /></span><div><small>Chỉ số cơ thể</small><p>Cân nặng <b>60 kg</b></p><p>BMI <b>21.5</b></p><p>Tỷ lệ mỡ <b>22%</b></p></div></article>
              <article className="landing-plan-note note-ratio"><i className="landing-note-clip" /><span><Dumbbell /></span><div><small>Tỷ lệ dinh dưỡng</small><p>Protein <b>30%</b></p><p>Carb <b>45%</b></p><p>Fat <b>25%</b></p><b className="landing-note-ratio-bar"><i /><i /><i /></b></div></article>
              <article className="landing-plan-note note-progress"><span><TrendingUp /></span><div><small>Tiến độ mục tiêu</small><strong>68%</strong><em>Cố lên, bạn đang làm tốt</em><b className="landing-note-bar"><i style={{ width: "68%" }} /></b></div></article>
            </div>
            <Leaf className="landing-plan-leaf leaf-a" aria-hidden="true" />
            <Leaf className="landing-plan-leaf leaf-b" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="landing-community" id="community">
        <div className="landing-container landing-community-shell">
          <div className="landing-community-hero">
            <div className="landing-community-copy">
              <span className="landing-community-badge"><HeartPulse /> Cộng đồng Nouri</span>
              <h2>Cùng nhau<br /><strong>sống khỏe hơn</strong><br />mỗi ngày. <Leaf aria-hidden="true" /></h2>
              <p>Chia sẻ hành trình, tìm cảm hứng và nhận lời khuyên từ cộng đồng yêu lối sống lành mạnh.</p>

              <div className="landing-community-stats">
                <article><span><UsersRound /></span><div><strong>20K+</strong><small>Thành viên</small></div></article>
                <article><span><MessageCircle /></span><div><strong>5K+</strong><small>Bài viết chia sẻ</small></div></article>
                <article><span><Heart /></span><div><strong>15K+</strong><small>Lượt tương tác</small></div></article>
              </div>

              <div className="landing-community-actions">
                <Link className="primary" to={appLink}>Tham gia ngay <ArrowRight /></Link>
                <Link className="secondary" to={appLink}>Khám phá cộng đồng <ArrowRight /></Link>
              </div>
            </div>

            <div className="landing-community-visual">
              <div className="landing-community-blob" aria-hidden="true" />
              <div className="landing-community-dots" aria-hidden="true" />
              <figure className="landing-community-photo landing-community-photo-main"><img src="/assets/nutrition-hero.jpg" alt="Bữa ăn lành mạnh được chia sẻ trong cộng đồng Nouri" /></figure>
              <figure className="landing-community-photo landing-community-photo-yoga"><img src="/assets/community-yoga.jpg" alt="Hai thành viên cùng tập yoga ngoài trời" /></figure>
              <figure className="landing-community-photo landing-community-photo-smoothie"><img src="/assets/community-smoothie.jpg" alt="Smoothie xanh và bữa sáng lành mạnh" /></figure>

              <article className="landing-community-float landing-community-active-card">
                <div className="landing-community-avatars"><span>AN</span><span>MY</span><span>LI</span></div>
                <div><strong>2.340</strong><small>thành viên</small><b>đang hoạt động</b></div>
              </article>

              <article className="landing-community-float landing-community-post-card">
                <img src="/assets/community-yoga.jpg" alt="" />
                <div><strong>Bữa trưa hôm nay<br />siêu healthy!</strong><span><Heart /> 128 <i /> 2 giờ trước</span></div>
              </article>

              <article className="landing-community-float landing-community-tip-card">
                <span><Lightbulb /></span><strong>Gợi ý thực đơn<br />giàu dinh dưỡng</strong><ArrowRight />
              </article>
              <UsersRound className="landing-community-mark" aria-hidden="true" />
              <Leaf className="landing-community-leaf leaf-one" aria-hidden="true" />
              <Leaf className="landing-community-leaf leaf-two" aria-hidden="true" />
            </div>
          </div>

          <div className="landing-community-feature-grid">
            {communityHighlights.map(({ icon: Icon, title, copy, image }) => <article className="landing-community-feature" key={title}>
              <figure className="landing-community-feature-media" aria-hidden="true"><img src={image} alt="" loading="lazy" /></figure>
              <div className="landing-community-feature-content">
                <span className="landing-community-feature-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <Link to={appLink} aria-label={`Khám phá ${title}`}><ArrowRight /></Link>
              </div>
            </article>)}
          </div>
        </div>
      </section>
    </main>

    <footer className="landing-footer" id="about">
      <FooterBotanical side="left" />
      <FooterBotanical side="right" />

      <div className="landing-container">
        <div className="landing-footer-grid">
          <section className="landing-footer-brand" aria-label="Giới thiệu Nouri">
            <Link to="/" className="landing-footer-logo" aria-label="Nouri - Trang chủ"><Logo /></Link>
            <strong>Ăn ngon hơn. Sống khỏe hơn.</strong>
            <p>Nền tảng giúp bạn lên thực đơn, khám phá công thức và chăm sóc dinh dưỡng mỗi ngày.</p>
            <nav className="landing-footer-socials" aria-label="Kênh cộng đồng Nouri">
              <Link to="/community" aria-label="Nouri trên Facebook"><Facebook /></Link>
              <Link to="/community" aria-label="Nouri trên Instagram"><Instagram /></Link>
              <a href="mailto:hello@nouri.vn" aria-label="Gửi email cho Nouri"><Mail /></a>
            </nav>
          </section>

          {footerGroups.map((group) => <nav className="landing-footer-group" aria-label={group.title} key={group.title}>
            <h2>{group.title}<Leaf aria-hidden="true" /></h2>
            <ul>
              {group.links.map(({ label, href, icon: Icon }) => <li key={label}>
                {href.startsWith("mailto:")
                  ? <a href={href}><Icon aria-hidden="true" /><span>{label}</span></a>
                  : <Link to={href}><Icon aria-hidden="true" /><span>{label}</span></Link>}
              </li>)}
            </ul>
          </nav>)}
        </div>
      </div>
    </footer>
  </div>;
}
