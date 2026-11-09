import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { authErrorMessage, validateAuthForm, validateChangePassword } from "./auth.logic";

const httpError = (status: number, data?: unknown) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, { status, statusText: "", headers: {}, config, data });
};

describe("Change password form (GĐ4)", () => {
  it("matches the backend limits and asks for a matching confirmation", () => {
    expect(validateChangePassword({ currentPassword: "Demo@123", newPassword: "Moi@123456", confirmPassword: "Moi@123456" })).toEqual({});
    expect(validateChangePassword({ currentPassword: "", newPassword: "ngan", confirmPassword: "khac" })).toEqual({
      currentPassword: "Nhập mật khẩu bạn đang dùng.",
      newPassword: "Mật khẩu mới cần ít nhất 8 ký tự.",
      confirmPassword: "Nhập lại đúng mật khẩu mới.",
    });
    expect(validateChangePassword({ currentPassword: "Demo@123", newPassword: "Demo@123", confirmPassword: "Demo@123" }).newPassword)
      .toBe("Chọn mật khẩu khác mật khẩu hiện tại.");
    expect(validateChangePassword({ currentPassword: "a", newPassword: "x".repeat(73), confirmPassword: "x".repeat(73) }).newPassword)
      .toBe("Mật khẩu mới tối đa 72 ký tự.");
  });
});

describe("Auth form", () => {
  it("validates with the backend limits and says how to fix each field", () => {
    expect(validateAuthForm({ name: "", email: "demo@nouri.vn", password: "Demo@123" }, "login")).toEqual({});
    expect(validateAuthForm({ name: "A", email: "demo@nouri", password: "1234567" }, "register")).toEqual({
      name: "Nhập họ tên từ 2 đến 80 ký tự.",
      email: "Nhập email đúng dạng, ví dụ ten@gmail.com.",
      password: "Mật khẩu cần ít nhất 8 ký tự.",
    });
    expect(validateAuthForm({ name: "", email: "a@b.vn", password: "x".repeat(73) }, "login").password).toBe("Mật khẩu tối đa 72 ký tự.");
  });

  it("explains wrong credentials, a locked account and an existing email", () => {
    expect(authErrorMessage(httpError(401, { message: "Email hoặc mật khẩu không đúng." }), "login"))
      .toBe("Email hoặc mật khẩu chưa đúng. Kiểm tra lại rồi thử lần nữa.");
    expect(authErrorMessage(httpError(403, { message: "Tài khoản của bạn đã bị khóa.", details: { code: "ACCOUNT_LOCKED" } }), "login"))
      .toBe("Tài khoản này đã bị khóa nên chưa đăng nhập được. Liên hệ quản trị viên Nouri để được mở lại.");
    expect(authErrorMessage(httpError(409, { message: "Email này đã được sử dụng." }), "register"))
      .toBe("Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng email khác để đăng ký.");
    expect(authErrorMessage(httpError(500, { message: "Máy chủ gặp lỗi." }), "login")).toBe("Máy chủ gặp lỗi.");
    expect(authErrorMessage(new AxiosError("Network Error"), "login")).toBe("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  });
});
