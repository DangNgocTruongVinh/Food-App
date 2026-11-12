import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import type { ResetPasswordErrors, ResetPasswordValues } from "../../features/auth/auth.logic";

// Form quên mật khẩu / đặt mật khẩu mới, cùng kiểu với form đăng nhập (lớp dn-*, lỗi ngay dưới ô, khóa form khi đang gửi).

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="dn-msg"><CircleAlert aria-hidden="true" />{message}</p>;
}

function Alerts({ error, notice }: { error: string; notice?: string }) {
  return (
    <>
      {error && <p className="dn-alert" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}
      {notice && <p className="dn-alert dn-alert--ok" role="status"><Check aria-hidden="true" />{notice}</p>}
    </>
  );
}

function Submit({ loading, label, busy }: { loading: boolean; label: string; busy: string }) {
  return (
    <button className="dn-cta" type="submit" disabled={loading} aria-busy={loading}>
      {loading && <LoaderCircle className="dn-spin" aria-hidden="true" />}
      <span>{loading ? busy : label}</span>
    </button>
  );
}

const BackToLogin = () => (
  <p className="dn-foot"><span>Nhớ ra mật khẩu?</span><Link className="dn-link dn-link--gold" to="/login">Quay lại đăng nhập</Link></p>
);

type ForgotProps = {
  email: string; emailError?: string; error: string; notice: string; loading: boolean;
  onChange: (email: string) => void; onSubmit: (event: FormEvent) => void;
};

export function ForgotPasswordForm({ email, emailError, error, notice, loading, onChange, onSubmit }: ForgotProps) {
  return (
    <div className="dn-stack">
      <h1 className="dn-title">Quên mật khẩu</h1>
      <p className="dn-lede">Nhập email đã đăng ký. Nouri sẽ gửi liên kết đặt mật khẩu mới, dùng được một lần trong 30 phút.</p>
      <Alerts error={error} notice={notice} />
      <form className="dn-form" noValidate onSubmit={onSubmit} aria-busy={loading}>
        <div className="dn-field">
          <label className="dn-label" htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email" className={`dn-input${emailError ? " is-invalid" : ""}`} type="email" inputMode="email" autoComplete="email"
            autoCapitalize="none" spellCheck={false} value={email} disabled={loading}
            aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? "forgot-email-error" : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          <FieldError id="forgot-email-error" message={emailError} />
        </div>
        <Submit loading={loading} label="Gửi liên kết đặt lại" busy="Đang gửi..." />
      </form>
      <BackToLogin />
    </div>
  );
}

type ResetProps = {
  values: ResetPasswordValues; errors: ResetPasswordErrors; error: string; loading: boolean; missingToken: boolean;
  onChange: (key: keyof ResetPasswordValues, value: string) => void; onSubmit: (event: FormEvent) => void;
};

export function ResetPasswordForm({ values, errors, error, loading, missingToken, onChange, onSubmit }: ResetProps) {
  const [show, setShow] = useState(false);
  if (missingToken) {
    return (
      <div className="dn-stack">
        <h1 className="dn-title">Liên kết không hợp lệ</h1>
        <p className="dn-lede">Liên kết đặt lại mật khẩu thiếu mã hoặc đã được dùng. Hãy mở lại liên kết mới nhất trong email.</p>
        <p className="dn-foot"><Link className="dn-link dn-link--gold" to="/forgot-password">Yêu cầu liên kết mới</Link></p>
      </div>
    );
  }
  const field = (key: keyof ResetPasswordValues, label: string) => (
    <div className="dn-field">
      <label className="dn-label" htmlFor={`reset-${key}`}>{label}</label>
      <input
        id={`reset-${key}`} className={`dn-input${errors[key] ? " is-invalid" : ""}`} type={show ? "text" : "password"}
        autoComplete="new-password" value={values[key]} disabled={loading} aria-invalid={errors[key] ? true : undefined}
        aria-describedby={[errors[key] && `reset-${key}-error`, key === "password" && "reset-password-hint"].filter(Boolean).join(" ") || undefined}
        onChange={(event) => onChange(key, event.target.value)}
      />
      <FieldError id={`reset-${key}-error`} message={errors[key]} />
      {key === "password" && <p id="reset-password-hint" className="dn-hint">Ít nhất 8 ký tự.</p>}
    </div>
  );
  return (
    <div className="dn-stack">
      <h1 className="dn-title">Đặt mật khẩu mới</h1>
      <p className="dn-lede">Đổi xong, mọi thiết bị đang đăng nhập tài khoản này sẽ bị đăng xuất.</p>
      <Alerts error={error} />
      <form className="dn-form" noValidate onSubmit={onSubmit} aria-busy={loading}>
        {field("password", "Mật khẩu mới")}
        {field("confirmPassword", "Nhập lại mật khẩu mới")}
        <div className="dn-row">
          <label className="dn-check">
            <input type="checkbox" checked={show} disabled={loading} onChange={(event) => setShow(event.target.checked)} />
            <span>Hiện mật khẩu</span>
          </label>
        </div>
        <Submit loading={loading} label="Lưu mật khẩu mới" busy="Đang lưu..." />
      </form>
      <BackToLogin />
    </div>
  );
}
