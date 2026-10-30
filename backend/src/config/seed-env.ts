import { z } from "zod";

// Biến môi trường chỉ dùng cho prisma/seed.ts (server không đọc). Khai báo tên trong .env.example, không ghi giá trị.
const optionalText = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().optional());

export const seedEnvSchema = z.object({
  ADMIN_EMAIL: optionalText.pipe(z.string().trim().toLowerCase().email().optional()),
  ADMIN_PASSWORD: optionalText.pipe(z.string().min(8, "ADMIN_PASSWORD cần tối thiểu 8 ký tự.").optional()),
  // "true": cố ý cập nhật lại các món gốc của seed (ghi đè chỉnh sửa của Admin trên các món đó). Mặc định tắt.
  SEED_UPDATE_RECIPES: optionalText.pipe(z.enum(["true", "false"]).default("false")).transform((value) => value === "true"),
}).refine((value) => Boolean(value.ADMIN_EMAIL) === Boolean(value.ADMIN_PASSWORD), {
  message: "Cần khai báo cả ADMIN_EMAIL và ADMIN_PASSWORD (hoặc bỏ trống cả hai).",
  path: ["ADMIN_PASSWORD"],
});

export function readSeedEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = seedEnvSchema.parse(source);
  return {
    admin: parsed.ADMIN_EMAIL && parsed.ADMIN_PASSWORD ? { email: parsed.ADMIN_EMAIL, password: parsed.ADMIN_PASSWORD } : null,
    updateRecipes: parsed.SEED_UPDATE_RECIPES,
  };
}
