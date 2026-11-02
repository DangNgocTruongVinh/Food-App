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
