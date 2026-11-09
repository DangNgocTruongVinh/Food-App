import axios from "axios";

export type AuthMode = "login" | "register";
export type AuthFormValues = { name: string; email: string; password: string };
export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kiểm tra trước khi gửi, khớp backend (auth.schema.ts): tên 2–80 ký tự, email hợp lệ, mật khẩu 8–72 ký tự. */
export function validateAuthForm(form: AuthFormValues, mode: AuthMode): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const name = form.name.trim();
  if (mode === "register" && (name.length < 2 || name.length > 80)) errors.name = "Nhập họ tên từ 2 đến 80 ký tự.";
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Nhập email đúng dạng, ví dụ ten@gmail.com.";
  if (form.password.length < 8) errors.password = "Mật khẩu cần ít nhất 8 ký tự.";
  else if (form.password.length > 72) errors.password = "Mật khẩu tối đa 72 ký tự.";
  return errors;
}

export type ChangePasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };
export type ChangePasswordErrors = Partial<Record<keyof ChangePasswordValues, string>>;
export const emptyChangePassword: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** Đổi mật khẩu (GĐ4), khớp backend: 8–72 ký tự, mật khẩu mới khác mật khẩu hiện tại; nhập lại phải trùng. */
export function validateChangePassword(values: ChangePasswordValues): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!values.currentPassword) errors.currentPassword = "Nhập mật khẩu bạn đang dùng.";
  if (values.newPassword.length < 8) errors.newPassword = "Mật khẩu mới cần ít nhất 8 ký tự.";
  else if (values.newPassword.length > 72) errors.newPassword = "Mật khẩu mới tối đa 72 ký tự.";
  else if (values.newPassword === values.currentPassword) errors.newPassword = "Chọn mật khẩu khác mật khẩu hiện tại.";
  if (values.confirmPassword !== values.newPassword) errors.confirmPassword = "Nhập lại đúng mật khẩu mới.";
  return errors;
}

/** Lời báo lỗi đăng nhập/đăng ký nói rõ chuyện gì xảy ra và làm gì tiếp. */
export function authErrorMessage(error: unknown, mode: AuthMode) {
  if (!axios.isAxiosError(error)) return "Đã có lỗi. Thử lại sau ít phút.";
  if (!error.response) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  const { status, data } = error.response as { status: number; data?: { message?: string; details?: { code?: string } } };
  if (status === 403 && data?.details?.code === "ACCOUNT_LOCKED") {
    return "Tài khoản này đã bị khóa nên chưa đăng nhập được. Liên hệ quản trị viên Nouri để được mở lại.";
  }
  if (status === 401 && mode === "login") return "Email hoặc mật khẩu chưa đúng. Kiểm tra lại rồi thử lần nữa.";
  if (status === 409 && mode === "register") return "Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng email khác để đăng ký.";
  if (status === 422 || status === 400) return "Thông tin chưa hợp lệ. Kiểm tra lại email và mật khẩu (ít nhất 8 ký tự).";
  return data?.message ?? "Máy chủ đang gặp lỗi. Thử lại sau ít phút.";
}

/** Đường dẫn trang đăng nhập: `mode: "register"` mở sẵn form đăng ký; `next` là trang mở sau khi đăng nhập. */
export function loginPath({ mode, next }: { mode?: AuthMode; next?: string } = {}) {
  const params = new URLSearchParams();
  if (mode === "register") params.set("mode", "register");
  if (next) params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/** Trang mở sau khi đăng nhập: chỉ nhận đường dẫn trong ứng dụng ("/recipes/abc"); "//site", "https://…", "/\site" về /dashboard. */
export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || raw.startsWith("/login")) return "/dashboard";
  return raw;
}
