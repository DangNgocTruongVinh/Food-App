import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { ResetPasswordForm } from "../components/auth/PasswordRecoveryForms";
import { resetPassword } from "../features/auth/auth.api";
import { recoveryErrorMessage, type ResetPasswordValues, validateResetPassword } from "../features/auth/auth.logic";

/**
 * /reset-password?token=…: mở từ email. Đọc token một lần rồi xóa khỏi thanh địa chỉ (không nằm lại trong lịch sử/Referer).
 * Đổi xong về /login?reset=1 (mọi phiên cũ đã bị thu hồi, người dùng đăng nhập lại bằng mật khẩu mới).
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [values, setValues] = useState<ResetPasswordValues>({ password: "", confirmPassword: "" });
  const [submitted, setSubmitted] = useState(false);
  const reset = useMutation({ mutationFn: () => resetPassword(token, values.password) });
  const errors = submitted ? validateResetPassword(values) : {};

  useEffect(() => {
    if (params.has("token")) setParams({}, { replace: true });
  }, [params, setParams]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateResetPassword(values)).length || reset.isPending) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".dn-form [aria-invalid='true']")?.focus());
      return;
    }
    reset.mutate(undefined, { onSuccess: () => navigate("/login?reset=1", { replace: true }) });
  };

  return (
    <AuthShell label="Đặt mật khẩu mới">
      <ResetPasswordForm
        values={values}
        errors={errors}
        error={reset.isError ? recoveryErrorMessage(reset.error) : ""}
        loading={reset.isPending}
        missingToken={!token}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSubmit={submit}
      />
    </AuthShell>
  );
}
