import { z } from "zod";

// Biến môi trường chỉ dùng cho prisma/seed.ts (server không đọc). Khai báo tên trong .env.example, không ghi giá trị.
const optionalText = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().optional());

export const seedEnvSchema = z.object({
  ADMIN_EMAIL: optionalText.pipe(z.string().trim().toLowerCase().email().optional()),
  ADMIN_PASSWORD: optionalText.pipe(z.string().min(8, "ADMIN_PASSWORD cần tối thiểu 8 ký tự.").optional()),
  // "true": cố ý cập nhật lại các món gốc của seed (ghi đè chỉnh sửa của Admin trên các món đó). Mặc định tắt.
  SEED_UPDATE_RECIPES: optionalText.pipe(z.enum(["true", "false"]).default("false")).transform((value) => value === "true"),
  // Audit M4: "true" thì seed tạo tài khoản demo (mật khẩu DEMO_PASSWORD) và các tài khoản mẫu minh họa; demo:reset chỉ chạy khi
  // bật. Mặc định tắt: máy chủ thật không có tài khoản mật khẩu biết trước.
  SEED_DEMO: optionalText.pipe(z.enum(["true", "false"]).default("false")).transform((value) => value === "true"),
  DEMO_PASSWORD: optionalText.pipe(z.string().min(8, "DEMO_PASSWORD cần tối thiểu 8 ký tự.").optional()),
}).refine((value) => Boolean(value.ADMIN_EMAIL) === Boolean(value.ADMIN_PASSWORD), {
  message: "Cần khai báo cả ADMIN_EMAIL và ADMIN_PASSWORD (hoặc bỏ trống cả hai).",
  path: ["ADMIN_PASSWORD"],
}).refine((value) => !value.SEED_DEMO || Boolean(value.DEMO_PASSWORD), {
  message: "SEED_DEMO=true cần khai báo DEMO_PASSWORD (mật khẩu tài khoản demo).",
  path: ["DEMO_PASSWORD"],
});

export function readSeedEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = seedEnvSchema.parse(source);
  return {
    admin: parsed.ADMIN_EMAIL && parsed.ADMIN_PASSWORD ? { email: parsed.ADMIN_EMAIL, password: parsed.ADMIN_PASSWORD } : null,
    updateRecipes: parsed.SEED_UPDATE_RECIPES,
    demo: parsed.SEED_DEMO && parsed.DEMO_PASSWORD ? { password: parsed.DEMO_PASSWORD } : null,
  };
}

/** demo:reset: mật khẩu demo, hoặc báo lỗi khi SEED_DEMO chưa bật (không đặt lại/tạo demo trên máy chủ thật). */
export function demoResetPassword(source: NodeJS.ProcessEnv = process.env) {
  const { demo } = readSeedEnv(source);
  if (!demo) throw new Error("Đã từ chối: SEED_DEMO đang tắt. Đặt SEED_DEMO=true và DEMO_PASSWORD trong .env nếu đây là máy demo.");
  return demo.password;
}
