import { describe, expect, it, vi } from "vitest";
import { passwordChangedEmail } from "./email-templates.js";
import { createMailer, redirectDemoMail, sendMailInBackground } from "./email.service.js";

vi.mock("../config/env.js", () => ({ env: { SMTP_PORT: 587 } }));

const message = { to: "demo@nouri.vn", subject: "Thử", html: "<p>Xin chào</p>", text: "Xin chào" };

describe("email.service (transport giả lập, không gửi thật)", () => {
  it("có SMTP: gửi qua transport với địa chỉ MAIL_FROM", async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };
    await createMailer(transport as never, "Nouri <no-reply@nouri.vn>")(message);
    expect(transport.sendMail).toHaveBeenCalledWith({ from: "Nouri <no-reply@nouri.vn>", ...message });
  });

  it("chưa cấu hình SMTP: chỉ ghi email ra log", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await createMailer(null, undefined)(message);
    expect(info.mock.calls[0][0]).toContain("[email chưa cấu hình] Tới: demo@nouri.vn");
    info.mockRestore();
  });

  it("gửi nền: lỗi SMTP chỉ ghi log, không làm hỏng request", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMailInBackground(message, vi.fn().mockRejectedValue(new Error("535 auth failed")));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(error).toHaveBeenCalledWith("Gửi email lỗi:", "535 auth failed");
    error.mockRestore();
  });

  it("mẫu email có bản HTML và bản chữ, giờ Việt Nam", () => {
    const mail = passwordChangedEmail({ email: "a@b.vn", name: "An" }, new Date("2026-11-13T01:30:00.000Z"));
    expect(mail.text).toContain("08:30");
    expect(mail.html).toContain("<html lang=\"vi\">");
  });
});

describe("DEMO_EMAIL_INBOX", () => {
  it("chỉ thư gửi tài khoản demo được chuyển tới hộp thư demo; tài khoản khác giữ nguyên", async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };
    const send = createMailer(transport as never, "Nouri <a@b.vn>", "toi@gmail.com");
    await send({ ...message, to: "Demo@Nouri.vn" });
    await send({ ...message, to: "khac@nouri.vn" });
    expect(transport.sendMail.mock.calls[0][0]).toMatchObject({ to: "toi@gmail.com", subject: "[Demo demo@nouri.vn] Thử" });
    expect(transport.sendMail.mock.calls[1][0]).toMatchObject({ to: "khac@nouri.vn", subject: "Thử" });
    expect(redirectDemoMail(message, undefined)).toBe(message);
  });
});
