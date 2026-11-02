import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { Logo, ThemeToggle } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { type AuthFormValues, type AuthMode, authErrorMessage, validateAuthForm } from "../features/auth/auth.logic";
import { getRememberLoginPreference } from "../features/auth/auth.storage";

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthFormValues>({ name: "", email: "", password: "" });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(getRememberLoginPreference);
  const errors = submitted ? validateAuthForm(form, mode) : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setServerError(authErrorMessage(error, mode));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((value) => (value === "login" ? "register" : "login"));
    setSubmitted(false);
    setServerError("");
  };

  return (
    <div className="dn-page">
      <header className="dn-top">
        <Link to="/" className="dn-top__logo" aria-label="Về trang chủ Nouri"><Logo /></Link>
        <ThemeToggle />
      </header>
      <main id="noi-dung-chinh" className="dn-layout">
        <section className="dn-panel" aria-label={mode === "register" ? "Đăng ký" : "Đăng nhập"}>
          <AuthForm
            mode={mode}
            form={form}
            errors={errors}
            serverError={serverError}
            loading={loading}
            remember={rememberLogin}
            onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
            onRememberChange={setRememberLogin}
            onSubmit={(event) => void submit(event)}
            onToggleMode={toggleMode}
          />
        </section>
        {/* Chưa có ảnh món ăn thật: khối --surface-2 kèm một câu giới thiệu cụ thể (DESIGN.md mục 10). */}
        <aside className="dn-aside" aria-label="Giới thiệu Nouri">
          <p className="dn-aside__text">
            Nouri ghi lại thực phẩm trong tủ bếp, nhắc món sắp hết hạn và xếp thực đơn 7 ngày theo calo, chế độ ăn và dị ứng của bạn.
          </p>
        </aside>
      </main>
    </div>
  );
}
