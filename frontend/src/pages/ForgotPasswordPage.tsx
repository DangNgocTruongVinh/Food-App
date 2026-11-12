import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { AuthShell } from "../components/auth/AuthShell";
import { ForgotPasswordForm } from "../components/auth/PasswordRecoveryForms";
import { forgotPassword } from "../features/auth/auth.api";
import { emailError, recoveryErrorMessage } from "../features/auth/auth.logic";

/** /forgot-password: nhập email → máy chủ luôn trả cùng một câu (không lộ email nào đã đăng ký). */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const request = useMutation({ mutationFn: forgotPassword });
  const fieldError = submitted ? emailError(email) : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (emailError(email) || request.isPending) {
      requestAnimationFrame(() => document.getElementById("forgot-email")?.focus());
      return;
    }
    request.mutate(email.trim());
  };

  return (
    <AuthShell label="Quên mật khẩu">
      <ForgotPasswordForm
        email={email}
        emailError={fieldError}
        error={request.isError ? recoveryErrorMessage(request.error) : ""}
        notice={request.data?.message ?? ""}
        loading={request.isPending}
        onChange={setEmail}
        onSubmit={submit}
      />
    </AuthShell>
  );
}
