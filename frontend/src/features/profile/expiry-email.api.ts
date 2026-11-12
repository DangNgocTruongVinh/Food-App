import { api } from "../../api/client";

// Nhắc đồ sắp hết hạn qua email: cài đặt lưu vào hồ sơ (PUT /profile), "Gửi thử ngay", "Tắt nhắc" từ email.

export type ExpiryEmailSettings = { expiryEmailEnabled: boolean; expiryEmailDays: number };
export type TestEmailResult = { sent: true; emailConfigured: boolean; remainingToday: number };

export async function saveExpiryEmailSettings(settings: ExpiryEmailSettings) {
  await api.put("/profile", settings);
}

export async function sendTestExpiryEmail() {
  return (await api.post<TestEmailResult>("/expiry-email/test", {})).data;
}

/** Không cần đăng nhập: token HMAC trong liên kết của email. */
export async function unsubscribeExpiryEmail(userId: string, token: string) {
  return (await api.post<{ message: string }>("/expiry-email/unsubscribe", { userId, token })).data;
}
