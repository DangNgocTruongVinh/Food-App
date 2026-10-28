import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  Sparkles,
  Sprout,
  UserRound,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../api/client";
import Logo from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import { getRememberLoginPreference } from "../features/auth/auth.storage";

const authBenefits = [
  { icon: Sprout, text: "Ưu tiên thực phẩm sạch, lành mạnh" },
  { icon: UserRound, text: "Cá nhân hóa theo mục tiêu của bạn" },
  { icon: CalendarDays, text: "Lập kế hoạch 7 ngày bằng AI thông minh" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLElement>(null);
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(getRememberLoginPreference);
  const auth = useAuth();

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".auth-scene img", { scale: 1.06, opacity: 0.7, duration: 1.35 })
      .from(".auth-brand", { y: -18, opacity: 0, duration: 0.58 }, 0.12)
      .from(".auth-story-copy > *", { y: 24, opacity: 0, duration: 0.68, stagger: 0.09 }, 0.24)
      .from(".auth-benefit", { x: -20, opacity: 0, duration: 0.52, stagger: 0.08 }, 0.55)
      .from(".auth-quote", { y: 14, opacity: 0, duration: 0.5 }, 0.76)
      .from(".auth-card", { x: 28, y: 12, scale: 0.975, opacity: 0, duration: 0.82 }, 0.28);
  }, { scope: pageRef });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (registerMode) {
        await auth.register(form.name, form.email, form.password);
      } else {
        await auth.login(form.email, form.password, rememberLogin);
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setRegisterMode((value) => !value);
    setError("");
  };

  return <main className="auth-page auth-page-v2" ref={pageRef}>
    <div className="auth-scene" aria-hidden="true">
      <img src="/assets/login-hero-salmon-v1.png" alt="" />
    </div>

    <section className="auth-story" aria-label="Giới thiệu Nouri">
      <Link className="auth-brand" to="/" aria-label="Về trang chủ Nouri"><Logo /></Link>

      <div className="auth-story-copy">
        <span className="auth-kicker"><Sparkles /> Dinh dưỡng thông minh mỗi ngày</span>
        <h1>Ăn ngon hơn.<br /><em>Sống khỏe hơn.</em></h1>
        <span className="auth-brush" aria-hidden="true" />
        <p>Biến những lựa chọn lành mạnh thành thói quen dễ dàng, ngon miệng và không tốn kém.</p>

        <div className="auth-benefits">
          {authBenefits.map(({ icon: Icon, text }) => <div className="auth-benefit" key={text}>
            <span><Icon aria-hidden="true" /></span>
            <p>{text}</p>
          </div>)}
        </div>
      </div>

      <blockquote className="auth-quote">
        <span aria-hidden="true">“</span>
        <p>You are what you eat.</p>
      </blockquote>
    </section>

    <section className="auth-panel" aria-label={registerMode ? "Đăng ký" : "Đăng nhập"}>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mobile-logo"><Link to="/"><Logo /></Link></div>
        <div className="auth-card-mark" aria-hidden="true"><Leaf /></div>
        <span className="auth-card-greeting">{registerMode ? "Bắt đầu hành trình mới" : "Chào mừng trở lại!"}</span>
        <h2>{registerMode ? "Tạo tài khoản" : "Đăng nhập"}</h2>
        <p>{registerMode
          ? "Thiết lập hồ sơ dinh dưỡng của bạn chỉ trong vài phút."
          : "Tiếp tục hành trình dinh dưỡng thông minh của bạn."}</p>

        <div className="auth-fields">
          {registerMode && <label>
            <span>Họ và tên</span>
            <div className="auth-input-shell">
              <UserRound aria-hidden="true" />
              <input
                required
                minLength={2}
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nguyễn Minh Anh"
              />
            </div>
          </label>}

          <label>
            <span>Email</span>
            <div className="auth-input-shell">
              <Mail aria-hidden="true" />
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@gmail.com"
              />
            </div>
          </label>

          <label>
            <span>Mật khẩu</span>
            <div className="auth-input-shell password-field">
              <LockKeyhole aria-hidden="true" />
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={8}
                autoComplete={registerMode ? "new-password" : "current-password"}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Tối thiểu 8 ký tự"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >{showPassword ? <EyeOff /> : <Eye />}</button>
            </div>
          </label>
        </div>

        {!registerMode && <div className="auth-options">
          <label className="auth-remember">
            <input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} />
            <span><Check /></span>
            Nhớ đăng nhập
          </label>
          <span className="auth-security-note">Thông tin được bảo mật</span>
        </div>}

        {error && <div className="form-error" role="alert">{error}</div>}

        <button className="auth-submit" disabled={loading}>
          <span>{loading ? "Đang xử lý..." : registerMode ? "Tạo tài khoản" : "Đăng nhập"}</span>
          <ArrowRight aria-hidden="true" />
        </button>

        <p className="auth-switch">
          {registerMode ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
          <button type="button" onClick={toggleMode}>{registerMode ? "Đăng nhập" : "Đăng ký miễn phí"}</button>
        </p>

        <small className="auth-legal">Bằng cách tiếp tục, bạn đồng ý với điều khoản và chính sách bảo mật của Nouri.</small>
      </form>
    </section>
  </main>;
}
