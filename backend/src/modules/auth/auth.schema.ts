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

/** /refresh và /logout không nhận dữ liệu nào ngoài cookie. */
export const emptySchema = z.object({ body: z.object({}).strict(), params: z.object({}), query: z.object({}) });

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
