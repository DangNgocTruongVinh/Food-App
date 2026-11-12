import { CircleAlert, Check, LoaderCircle } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import type { AuthFormErrors, AuthFormValues, AuthMode } from "../../features/auth/auth.logic";

type AuthFormProps = {
  mode: AuthMode;
  form: AuthFormValues;
  errors: AuthFormErrors;
  /** Email đã đúng dạng: hiện dấu tích trong ô (chỉ để nhìn, không thay cho kiểm tra khi gửi). */
  emailValid: boolean;
  serverError: string;
  loading: boolean;
  remember: boolean;
  onChange: (key: keyof AuthFormValues, value: string) => void;
  onEmailBlur: () => void;
  onRememberChange: (remember: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onToggleMode: () => void;
};

const COPY = {
  login: {
    title: "Chào bạn quay lại", lede: "Đăng nhập vào tài khoản Nouri của bạn.", submit: "Đăng nhập", busy: "Đang đăng nhập...",
    switchText: "Lần đầu đến với Nouri?", switchAction: "Tạo tài khoản",
  },
  register: {
    title: "Tạo tài khoản Nouri", lede: "Tạo xong, bạn điền hồ sơ dinh dưỡng để Nouri tính calo và lọc món theo chế độ ăn, dị ứng.",
    submit: "Tạo tài khoản", busy: "Đang tạo tài khoản...", switchText: "Đã có tài khoản?", switchAction: "Đăng nhập",
  },
} as const;

/** Lỗi ngay dưới ô nhập, gắn với ô bằng aria-describedby. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="dn-msg"><CircleAlert aria-hidden="true" />{message}</p>;
}

/**
 * Form đăng nhập / đăng ký theo bản thiết kế đã duyệt (nouri-login-handoff): lỗi máy chủ ở đầu form, lỗi từng ô ngay dưới ô,
 * hiện/ẩn mật khẩu, báo Caps Lock, khóa form khi đang gửi. Nút Google/Apple/Microsoft và "Quên mật khẩu?" của bản thiết kế
 * không hiện vì Nouri chưa có các luồng đó (OAuth tùy chọn; quên mật khẩu ghi ở hướng phát triển).
 */
export function AuthForm(props: AuthFormProps) {
  const { mode, form, errors, emailValid, serverError, loading, remember, onChange, onEmailBlur, onRememberChange, onSubmit, onToggleMode } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const register = mode === "register";
  const copy = COPY[mode];
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  const describedBy = (...ids: Array<string | false>) => ids.filter(Boolean).join(" ") || undefined;

  return (
    <div className="dn-stack">
      <h1 className="dn-title">{copy.title}</h1>
      <p className="dn-lede">{copy.lede}</p>
      {serverError && <p className="dn-alert" role="alert"><CircleAlert aria-hidden="true" />{serverError}</p>}

      <form id="auth-form" className="dn-form" noValidate onSubmit={onSubmit} aria-busy={loading}>
        {register && (
          <div className="dn-field">
            <label className="dn-label" htmlFor="auth-name">Họ và tên</label>
            <input
              id="auth-name"
              className={`dn-input${errors.name ? " is-invalid" : ""}`}
              autoComplete="name"
              value={form.name}
              disabled={loading}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy(Boolean(errors.name) && "auth-name-error")}
              onChange={(event) => onChange("name", event.target.value)}
            />
            <FieldError id="auth-name-error" message={errors.name} />
          </div>
        )}

        <div className="dn-field">
          <label className="dn-label" htmlFor="auth-email">Email</label>
          <div className="dn-control">
            <input
              id="auth-email"
              className={`dn-input dn-input--state${errors.email ? " is-invalid" : ""}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={form.email}
              disabled={loading}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy(Boolean(errors.email) && "auth-email-error")}
              onChange={(event) => onChange("email", event.target.value)}
              onBlur={onEmailBlur}
            />
            {emailValid && !errors.email && <Check className="dn-tick" aria-hidden="true" />}
          </div>
          <FieldError id="auth-email-error" message={errors.email} />
        </div>

        <div className="dn-field">
          <label className="dn-label" htmlFor="auth-password">Mật khẩu</label>
          <div className="dn-control">
            <input
              id="auth-password"
              className={`dn-input dn-input--toggle${errors.password ? " is-invalid" : ""}`}
              type={showPassword ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              disabled={loading}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={describedBy(
                Boolean(errors.password) && "auth-password-error", register && "auth-password-hint", capsLock && "auth-password-caps",
              )}
              onChange={(event) => onChange("password", event.target.value)}
              onKeyDown={readCaps}
              onKeyUp={readCaps}
              onBlur={() => setCapsLock(false)}
            />
            <button
              type="button"
              className="dn-toggle"
              disabled={loading}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Ẩn" : "Hiện"}
            </button>
          </div>
          <FieldError id="auth-password-error" message={errors.password} />
          {register && <p id="auth-password-hint" className="dn-hint">Ít nhất 8 ký tự.</p>}
          {capsLock && <p id="auth-password-caps" className="dn-hint">Caps Lock đang bật.</p>}
        </div>

        {!register && (
          <div className="dn-row">
            <label className="dn-check">
              <input type="checkbox" checked={remember} disabled={loading} onChange={(event) => onRememberChange(event.target.checked)} />
              <span>Giữ tôi đăng nhập</span>
            </label>
          </div>
        )}

        <button className="dn-cta" type="submit" disabled={loading} aria-busy={loading}>
          {loading && <LoaderCircle className="dn-spin" aria-hidden="true" />}
          <span>{loading ? copy.busy : copy.submit}</span>
        </button>
      </form>

      <p className="dn-foot">
        <span>{copy.switchText}</span>
        <button type="button" className="dn-link dn-link--gold" disabled={loading} onClick={onToggleMode}>{copy.switchAction}</button>
      </p>
    </div>
  );
}
