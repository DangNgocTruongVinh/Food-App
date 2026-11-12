import type { MailMessage } from "./email.service.js";

// Mẫu email tiếng Việt: HTML đơn giản (bảng + style nội tuyến cho các trình đọc thư) kèm bản chữ thường. Màu theo thương hiệu
// (tokens.css: --home-forest-deep, --home-ivory, --home-gold). Tên người dùng là dữ liệu nhập nên luôn được escape.

const BRAND = { forest: "#12342a", ivory: "#faf8f2", gold: "#f6dfa6", ink: "#1f2a26", muted: "#5b6b64" };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char
));

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs.map((text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.ink}">${text}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;`
      + `background:${BRAND.forest};color:${BRAND.ivory};font-weight:600;text-decoration:none">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:${BRAND.ivory};font-family:Arial,Helvetica,sans-serif">`
    + `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">`
    + `<tr><td style="padding:20px 28px;background:${BRAND.forest};color:${BRAND.gold};font-size:22px;font-weight:700">Nouri</td></tr>`
    + `<tr><td style="padding:28px">`
    + `<h1 style="margin:0 0 16px;font-size:20px;color:${BRAND.forest}">${escapeHtml(title)}</h1>${body}${button}`
    + `<p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted}">Email tự động từ Nouri, vui lòng không trả lời.</p>`
    + `</td></tr></table></body></html>`;
}

export function passwordResetEmail(to: { email: string; name: string }, link: string, minutes: number): MailMessage {
  const name = escapeHtml(to.name);
  return {
    to: to.email,
    subject: "Đặt lại mật khẩu Nouri",
    html: layout("Đặt lại mật khẩu", [
      `Chào ${name},`,
      `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu tài khoản Nouri. Liên kết dưới đây dùng được một lần trong ${minutes} phút.`,
      "Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn vẫn giữ nguyên.",
    ], { label: "Đặt mật khẩu mới", url: link }),
    text: [
      `Chào ${to.name},`,
      "",
      `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu tài khoản Nouri. Mở liên kết sau trong ${minutes} phút (dùng được một lần):`,
      link,
      "",
      "Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn vẫn giữ nguyên.",
    ].join("\n"),
  };
}

export function passwordChangedEmail(to: { email: string; name: string }, changedAt: Date): MailMessage {
  const when = changedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
  const notice = "Nếu không phải bạn đổi, hãy đặt lại mật khẩu ngay và liên hệ quản trị viên Nouri.";
  return {
    to: to.email,
    subject: "Mật khẩu Nouri vừa được đổi",
    html: layout("Mật khẩu vừa được đổi", [
      `Chào ${escapeHtml(to.name)},`,
      `Mật khẩu tài khoản Nouri của bạn đã được đổi lúc ${when} (giờ Việt Nam). Mọi phiên đăng nhập cũ đã bị đăng xuất.`,
      notice,
    ]),
    text: [
      `Chào ${to.name},`,
      "",
      `Mật khẩu tài khoản Nouri của bạn đã được đổi lúc ${when} (giờ Việt Nam). Mọi phiên đăng nhập cũ đã bị đăng xuất.`,
      notice,
    ].join("\n"),
  };
}

export type ExpiringLine = { name: string; quantity: string; daysLeft: number };
export type SuggestedRecipe = { name: string; reason: string; url: string };

const daysText = (daysLeft: number) => (daysLeft <= 0 ? "hết hạn hôm nay" : `còn ${daysLeft} ngày`);

/** Email nhắc đồ sắp hết hạn: danh sách món, tối đa 3 món nên nấu (bộ gợi ý ngữ cảnh kho), nút "Mở kho", liên kết "Tắt nhắc". */
export function expiryReminderEmail(
  to: { email: string; name: string }, items: ExpiringLine[], recipes: SuggestedRecipe[], links: { pantry: string; unsubscribe: string },
): MailMessage {
  const list = items.map((item) => `<li style="margin:0 0 6px"><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.quantity)}): `
    + `${daysText(item.daysLeft)}</li>`).join("");
  const cook = recipes.map((recipe) => `<li style="margin:0 0 8px"><a href="${escapeHtml(recipe.url)}" style="color:${BRAND.forest};font-weight:600">`
    + `${escapeHtml(recipe.name)}</a><br><span style="color:${BRAND.muted}">${escapeHtml(recipe.reason)}</span></li>`).join("");
  const unsubscribe = `<a href="${escapeHtml(links.unsubscribe)}" style="color:${BRAND.muted}">Tắt nhắc</a>`;
  const html = layout("Đồ trong kho sắp hết hạn", [
    `Chào ${escapeHtml(to.name)}, trong kho của bạn có ${items.length} thực phẩm nên dùng sớm:`,
    `<ul style="margin:0;padding-left:20px">${list}</ul>`,
    ...(recipes.length ? ["Món nên nấu:", `<ul style="margin:0;padding-left:20px">${cook}</ul>`] : []),
  ], { label: "Mở kho", url: links.pantry }).replace(
    "Email tự động từ Nouri, vui lòng không trả lời.",
    `Email tự động từ Nouri, vui lòng không trả lời. Không muốn nhận nhắc nữa? ${unsubscribe}.`,
  );
  return {
    to: to.email,
    subject: `Nouri: ${items.length} thực phẩm sắp hết hạn`,
    html,
    text: [
      `Chào ${to.name}, trong kho của bạn có ${items.length} thực phẩm nên dùng sớm:`,
      ...items.map((item) => `- ${item.name} (${item.quantity}): ${daysText(item.daysLeft)}`),
      ...(recipes.length ? ["", "Món nên nấu:", ...recipes.map((recipe) => `- ${recipe.name}: ${recipe.reason} ${recipe.url}`)] : []),
      "",
      `Mở kho: ${links.pantry}`,
      `Tắt nhắc: ${links.unsubscribe}`,
    ].join("\n"),
  };
}
