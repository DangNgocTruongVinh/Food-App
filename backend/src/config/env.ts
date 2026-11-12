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
  // Quét hóa đơn bằng AI (GĐ3c phần 2): model phải đọc được ảnh.
  OPENAI_VISION_MODEL: z.preprocess((value) => (value === "" ? undefined : value), z.string().default("gpt-5-mini")),
  // Upload ảnh (tùy chọn): đủ cả ba hoặc không có biến nào; không có thì API upload trả 503, phần còn lại vẫn chạy.
  // Email (quên mật khẩu): SMTP_HOST + MAIL_FROM là đủ để gửi (SMTP_USER/SMTP_PASS khi máy chủ cần đăng nhập, vd. Gmail
  // dùng App Password). Thiếu thì email chỉ được ghi ra log, /api/health báo email chưa cấu hình.
  SMTP_HOST: optionalText,
  SMTP_PORT: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().min(1).max(65535).default(587)),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  MAIL_FROM: optionalText,
  // Tùy chọn: mọi email gửi cho tài khoản demo (demo@nouri.vn) được chuyển tới hộp thư này (chỉ tài khoản demo).
  DEMO_EMAIL_INBOX: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().email().optional()),
  // Nhắc đồ sắp hết hạn qua email: giờ gửi mỗi ngày (HH:mm, giờ Việt Nam).
  EXPIRY_EMAIL_TIME: z.preprocess((value) => (value === "" ? undefined : value), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("07:00")),
  CLOUDINARY_CLOUD_NAME: optionalText,
  CLOUDINARY_API_KEY: optionalText,
  CLOUDINARY_API_SECRET: optionalText,
  // Quét hóa đơn (GĐ3c): số lần quét tối đa mỗi người mỗi ngày (giờ Việt Nam), tính cả lần đọc lỗi.
  // Bảo mật (GĐ4): cookie refresh token chỉ gửi qua HTTPS. Bỏ trống = bật khi NODE_ENV=production (trình duyệt coi
  // http://localhost là an toàn nên demo Docker vẫn chạy). Truy cập bằng http qua IP mạng LAN thì đặt false.
  COOKIE_SECURE: z.preprocess((value) => (value === "" || value === undefined ? undefined : value === "true" || value === true), z.boolean().optional()),
  // Số proxy tin cậy phía trước backend (nginx của frontend = 1) để rate limit đọc đúng IP người dùng; 0 = kết nối trực tiếp.
  TRUST_PROXY: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().min(0).max(5).default(0)),
  // Hỏi Nouri: số câu hỏi tối đa mỗi người mỗi ngày (giờ Việt Nam).
  AI_CHAT_DAILY_LIMIT: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().min(1).max(1000).default(30)),
  RECEIPT_SCAN_DAILY_LIMIT: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().min(1).max(1000).default(10)),
}).refine(
  (value) => {
    const set = [value.CLOUDINARY_CLOUD_NAME, value.CLOUDINARY_API_KEY, value.CLOUDINARY_API_SECRET].filter(Boolean).length;
    return set === 0 || set === 3;
  },
  { message: "Cần khai báo đủ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (hoặc bỏ trống cả ba).", path: ["CLOUDINARY_CLOUD_NAME"] },
);

export const env = envSchema.parse(process.env);
// Biến chỉ dùng cho seed (ADMIN_EMAIL, ADMIN_PASSWORD, SEED_UPDATE_RECIPES): xem seed-env.ts.
