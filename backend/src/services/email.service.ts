import nodemailer, { type Transporter } from "nodemailer";
import { DEMO_EMAIL } from "../config/demo.js";
import { env } from "../config/env.js";

// Dịch vụ gửi email dùng chung (quên mật khẩu, báo đổi mật khẩu). Cấu hình SMTP từ .env; chưa cấu hình thì chỉ ghi email ra
// log (môi trường dev/demo không có SMTP vẫn thử được luồng). Không bao giờ ghi SMTP_PASS ra log.

export type MailMessage = { to: string; subject: string; html: string; text: string };
type MailTransport = Pick<Transporter, "sendMail">;

export function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

function createTransport(): MailTransport | null {
  if (!isEmailConfigured()) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465: TLS ngay từ đầu (Gmail); 587: STARTTLS
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** DEMO_EMAIL_INBOX: thư gửi tài khoản demo đi tới hộp thư thật (tiêu đề ghi rõ), các tài khoản khác giữ nguyên người nhận. */
export function redirectDemoMail(message: MailMessage, demoInbox: string | undefined): MailMessage {
  if (!demoInbox || message.to.trim().toLowerCase() !== DEMO_EMAIL) return message;
  return { ...message, to: demoInbox, subject: `[Demo ${DEMO_EMAIL}] ${message.subject}` };
}

export function createMailer(transport: MailTransport | null, from: string | undefined, demoInbox?: string) {
  return async function sendMail(original: MailMessage) {
    const message = redirectDemoMail(original, demoInbox);
    if (!transport || !from) {
      // shortcut: chưa có SMTP thì ghi cả nội dung (kể cả liên kết đặt lại mật khẩu) ra log để thử ở máy dev; production phải cấu hình SMTP.
      console.info(`[email chưa cấu hình] Tới: ${message.to} | Tiêu đề: ${message.subject}\n${message.text}`);
      return;
    }
    await transport.sendMail({ from, ...message });
  };
}

export const sendMail = createMailer(createTransport(), env.MAIL_FROM, env.DEMO_EMAIL_INBOX);

/** Gửi nền, không chờ: thời gian phản hồi API không tiết lộ email có tồn tại hay không; lỗi gửi chỉ ghi log. */
export function sendMailInBackground(message: MailMessage, send = sendMail) {
  void send(message).catch((error: unknown) => {
    console.error("Gửi email lỗi:", error instanceof Error ? error.message : error);
  });
}
