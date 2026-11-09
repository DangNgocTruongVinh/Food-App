import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { Logo } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { type AuthFormValues, type AuthMode, authErrorMessage, safeNextPath, validateAuthForm } from "../features/auth/auth.logic";
import { getRememberLoginPreference } from "../features/auth/auth.storage";

const asset = (path: string) => `${import.meta.env.BASE_URL}assets/login/${path}`;

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [params] = useSearchParams();
  // Bị Admin khóa khi đang dùng: client đăng xuất và chuyển về đây kèm ?locked=1 (api/client.ts).
  const lockedNotice = params.get("locked") === "1";
  // Landing: "Đăng ký miễn phí" mở sẵn form đăng ký (?mode=register); bấm món khi chưa đăng nhập thì quay lại món đó (?next=).
  const [mode, setMode] = useState<AuthMode>(() => (params.get("mode") === "register" ? "register" : "login"));
  const nextPath = safeNextPath(params.get("next"));
  const [form, setForm] = useState<AuthFormValues>({ name: "", email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  // Rời ô email khi đã nhập gì đó thì báo sai dạng ngay (bản thiết kế); ô trống chỉ báo khi bấm gửi.
  const [emailChecked, setEmailChecked] = useState(false);
  const [serverError, setServerError] = useState(() => (
    lockedNotice ? "Tài khoản của bạn đã bị khóa nên đã bị đăng xuất. Liên hệ quản trị viên Nouri để được mở lại." : ""
  ));
  const [loading, setLoading] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(getRememberLoginPreference);
  const allErrors = validateAuthForm(form, mode);
  const errors = submitted ? allErrors : emailChecked && form.email.trim() ? { email: allErrors.email } : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError("");
    if (Object.keys(validateAuthForm(form, mode)).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#auth-form [aria-invalid='true']")?.focus());
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") await auth.register(form.name.trim(), form.email.trim(), form.password);
      else await auth.login(form.email.trim(), form.password, rememberLogin);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setServerError(authErrorMessage(error, mode));
      if (mode === "login") {
        // Đăng nhập không được: xóa mật khẩu và đưa con trỏ về ô mật khẩu để nhập lại (bản thiết kế).
        setForm((current) => ({ ...current, password: "" }));
        setSubmitted(false);
        requestAnimationFrame(() => document.getElementById("auth-password")?.focus());
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((value) => (value === "login" ? "register" : "login"));
    setSubmitted(false);
    setEmailChecked(false);
    setServerError("");
  };

  return (
    <div className="dn-page">
      <div className="dn-photo">
        <picture>
          <source media="(max-width: 1023px)" srcSet={asset("hero-mobile.jpg")} />
          <img src={asset("hero-desktop.jpg")} alt="Đĩa cá hồi áp chảo với đậu que, cà chua bi và cơm súp lơ" />
        </picture>
        <div className="dn-scrim" />
        <p className="dn-slogan">Hôm nay ăn gì cho khỏe?</p>
      </div>
      <main id="noi-dung-chinh" className="dn-panel" aria-label={mode === "register" ? "Đăng ký" : "Đăng nhập"}>
        <div className="dn-bar">
          <Link to="/" className="dn-logo" aria-label="Nouri, trang chủ"><Logo /></Link>
        </div>
        <div className="dn-wrap">
          <AuthForm
            mode={mode}
            form={form}
            errors={errors}
            emailValid={!allErrors.email}
            serverError={serverError}
            loading={loading}
            remember={rememberLogin}
            onChange={(key, value) => {
              // Đang sửa email thì tạm ẩn lỗi dạng email, rời ô thì kiểm lại.
              if (key === "email") setEmailChecked(false);
              setForm((current) => ({ ...current, [key]: value }));
            }}
            onEmailBlur={() => setEmailChecked(true)}
            onRememberChange={setRememberLogin}
            onSubmit={(event) => void submit(event)}
            onToggleMode={toggleMode}
          />
        </div>
        {/* Điều khoản ở chân cột form: thông tin phụ, không chen vào giữa các thao tác đăng nhập. */}
        <p className="dn-legal">
          Khi tiếp tục, bạn đồng ý với <Link className="dn-legal__link" to="/terms">Điều khoản sử dụng</Link> và{" "}
          <Link className="dn-legal__link" to="/privacy">Chính sách bảo mật</Link> của Nouri.
        </p>
      </main>
    </div>
  );
}
