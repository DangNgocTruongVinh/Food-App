import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthFormErrors, AuthFormValues, AuthMode } from "../../features/auth/auth.logic";
import { Button, ErrorState, Field } from "../ui";

type AuthFormProps = {
  mode: AuthMode;
  form: AuthFormValues;
  errors: AuthFormErrors;
  serverError: string;
  loading: boolean;
  remember: boolean;
  onChange: (key: keyof AuthFormValues, value: string) => void;
  onRememberChange: (remember: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onToggleMode: () => void;
};

/** Form đăng nhập / đăng ký; lỗi hiện dưới từng trường, lỗi từ máy chủ hiện trên nút gửi. */
export function AuthForm({ mode, form, errors, serverError, loading, remember, onChange, onRememberChange, onSubmit, onToggleMode }: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const register = mode === "register";
  return (
    <form id="auth-form" className="dn-form" noValidate onSubmit={onSubmit}>
      <header className="dn-form__head">
        <h1 className="ui-title">{register ? "Tạo tài khoản Nouri" : "Đăng nhập Nouri"}</h1>
        <p className="ui-text">
          {register
            ? "Tạo xong, bạn điền hồ sơ dinh dưỡng để Nouri tính calo và lọc món theo chế độ ăn, dị ứng."
            : "Dùng email và mật khẩu bạn đã đăng ký."}
        </p>
      </header>

      {register && (
        <Field label="Họ và tên" error={errors.name}>
          {(control) => <input {...control} autoComplete="name" value={form.name} onChange={(event) => onChange("name", event.target.value)} />}
        </Field>
      )}
      <Field label="Email" error={errors.email}>
        {(control) => (
          <input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
          />
        )}
      </Field>
      <Field label="Mật khẩu" error={errors.password} hint={register ? "Ít nhất 8 ký tự." : undefined}>
        {(control) => (
          <span className="dn-password">
            <input
              {...control}
              type={showPassword ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) => onChange("password", event.target.value)}
            />
            <button
              type="button"
              className="dn-password__toggle"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        )}
      </Field>

      {!register && (
        <label className="dn-remember">
          <input type="checkbox" checked={remember} onChange={(event) => onRememberChange(event.target.checked)} />
          <span>Nhớ đăng nhập trên máy này</span>
        </label>
      )}

      {serverError && <ErrorState message={serverError} />}

      <Button type="submit" variant="primary" block busy={loading}>
        {loading ? "Đang xử lý..." : register ? "Tạo tài khoản" : "Đăng nhập"}
      </Button>

      <p className="dn-switch">
        <span>{register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}</span>
        <button type="button" className="ui-link dn-switch__button" onClick={onToggleMode}>{register ? "Đăng nhập" : "Đăng ký"}</button>
      </p>
      <p className="ui-small dn-legal">
        Khi tiếp tục, bạn đồng ý với <Link className="ui-link" to="/terms">Điều khoản sử dụng</Link> và{" "}
        <Link className="ui-link" to="/privacy">Chính sách bảo mật</Link> của Nouri.
      </p>
    </form>
  );
}
