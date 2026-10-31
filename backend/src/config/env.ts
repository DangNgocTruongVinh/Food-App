import "dotenv/config";
import { z } from "zod";

// docker-compose truyền biến tùy chọn rỗng ("") khi không khai báo: coi như không có.
const optionalText = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  // Upload ảnh (tùy chọn): đủ cả ba hoặc không có biến nào; không có thì API upload trả 503, phần còn lại vẫn chạy.
  CLOUDINARY_CLOUD_NAME: optionalText,
  CLOUDINARY_API_KEY: optionalText,
  CLOUDINARY_API_SECRET: optionalText,
}).refine(
  (value) => {
    const set = [value.CLOUDINARY_CLOUD_NAME, value.CLOUDINARY_API_KEY, value.CLOUDINARY_API_SECRET].filter(Boolean).length;
    return set === 0 || set === 3;
  },
  { message: "Cần khai báo đủ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (hoặc bỏ trống cả ba).", path: ["CLOUDINARY_CLOUD_NAME"] },
);

export const env = envSchema.parse(process.env);
// Biến chỉ dùng cho seed (ADMIN_EMAIL, ADMIN_PASSWORD, SEED_UPDATE_RECIPES): xem seed-env.ts.
