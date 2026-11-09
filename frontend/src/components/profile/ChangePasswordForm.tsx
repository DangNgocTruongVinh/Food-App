import type { FormEvent } from "react";
import type { ChangePasswordErrors, ChangePasswordValues } from "../../features/auth/auth.logic";
import { Button, ErrorState, Field } from "../ui";

type ChangePasswordFormProps = {
  values: ChangePasswordValues;
  errors: ChangePasswordErrors;
  saving: boolean;
  saveError: string;
  onChange: (key: keyof ChangePasswordValues, value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

const FIELDS: Array<{ key: keyof ChangePasswordValues; label: string; autoComplete: string; hint?: string }> = [
  { key: "currentPassword", label: "Mật khẩu hiện tại", autoComplete: "current-password" },
  { key: "newPassword", label: "Mật khẩu mới", autoComplete: "new-password", hint: "Từ 8 đến 72 ký tự." },
  { key: "confirmPassword", label: "Nhập lại mật khẩu mới", autoComplete: "new-password" },
];

/** Đổi mật khẩu (GĐ4): form riêng dưới hồ sơ. Đổi xong, các thiết bị khác bị đăng xuất, thiết bị này vẫn đăng nhập. */
export function ChangePasswordForm({ values, errors, saving, saveError, onChange, onSubmit }: ChangePasswordFormProps) {
  return (
    <form id="password-form" className="hs-form hs-password" noValidate onSubmit={onSubmit}>
      <section className="hs-section" aria-labelledby="hs-password-title">
        <header className="hs-section__head">
          <h2 id="hs-password-title" className="hs-section__title">Đổi mật khẩu</h2>
          <p className="ui-small">Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</p>
        </header>
        <div className="hs-section__fields">
          {FIELDS.map(({ key, label, autoComplete, hint }) => (
            <Field
              key={key}
              label={label}
              type="password"
              autoComplete={autoComplete}
              maxLength={72}
              value={values[key]}
              error={errors[key]}
              hint={hint}
              onChange={(event) => onChange(key, event.target.value)}
            />
          ))}
        </div>
      </section>
      <div className="hs-actions">
        {saveError && <ErrorState message={saveError} />}
        <div className="hs-actions__bar">
          <Button type="submit" variant="primary" busy={saving}>{saving ? "Đang đổi..." : "Đổi mật khẩu"}</Button>
        </div>
      </div>
    </form>
  );
}
