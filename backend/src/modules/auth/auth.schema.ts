import { z } from "zod";

const password = z.string().min(8).max(72);

export const loginSchema = z.object({
  // remember: "Nhớ đăng nhập" (mặc định có, như trước GĐ4).
  body: z.object({ email: z.string().email(), password, remember: z.boolean().default(true) }),
  params: z.object({}),
  query: z.object({}),
});

export const registerSchema = z.object({
  body: z.object({ email: z.string().email(), password, name: z.string().min(2).max(80) }),
  params: z.object({}),
  query: z.object({}),
});

export const changePasswordSchema = z.object({
  body: z.object({ currentPassword: password, newPassword: password }).refine(
    (value) => value.currentPassword !== value.newPassword,
    { message: "Mật khẩu mới phải khác mật khẩu hiện tại.", path: ["newPassword"] },
  ),
  params: z.object({}),
  query: z.object({}),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(254) }),
  params: z.object({}),
  query: z.object({}),
});

/** Mật khẩu mới kiểm như lúc đăng ký (8–72 ký tự). Token: base64url của 32 byte (43 ký tự). */
export const resetPasswordSchema = z.object({
  body: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password }),
  params: z.object({}),
  query: z.object({}),
});

/** /refresh và /logout không nhận dữ liệu nào ngoài cookie. */
export const emptySchema = z.object({ body: z.object({}).strict(), params: z.object({}), query: z.object({}) });

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
