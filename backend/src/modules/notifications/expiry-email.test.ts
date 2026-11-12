import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { cronExpressionOf, isValidUnsubscribeToken, pickExpiringItems, unsubscribeToken } from "./expiry-email.js";

const secret = "nouri-test-only-secret-at-least-32-characters";
type Log = { id: string; userId: string; dayKey: string; slot: string; itemKeys: string[]; createdAt: Date };
const db = vi.hoisted(() => ({
  logs: [] as Array<{ id: string; userId: string; dayKey: string; slot: string; itemKeys: string[]; createdAt: Date }>,
  pantry: [] as unknown[], profiles: [] as unknown[], configured: true, clock: new Date(),
  recommend: vi.fn(), updateProfiles: vi.fn(), findUser: vi.fn(), findProfile: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: "nouri-test-only-secret-at-least-32-characters", FRONTEND_URL: "http://localhost:8080" } }));
vi.mock("../../services/email.service.js", () => ({ isEmailConfigured: () => db.configured, sendMail: vi.fn() }));
vi.mock("../recommendation/recommendation.service.js", () => ({ getRecommendations: db.recommend }));
vi.mock("../../lib/prisma.js", async () => {
  const { Prisma: P } = await import("@prisma/client");
  return { prisma: {
    pantryItem: { findMany: async () => db.pantry },
    nutritionProfile: { findMany: async () => db.profiles, findUnique: db.findProfile, updateMany: db.updateProfiles },
    user: { findUnique: db.findUser },
    expiryEmailLog: {
      findMany: async ({ where }: { where: { userId: string; slot: string } }) => db.logs.filter((log) => log.userId === where.userId && log.slot === where.slot),
      count: async ({ where }: { where: { userId: string; dayKey: string } }) =>
        db.logs.filter((log) => log.userId === where.userId && log.dayKey === where.dayKey && log.slot.startsWith("test-")).length,
      // Khóa unique (userId, dayKey, slot) như DB thật.
      create: async ({ data }: { data: Omit<Log, "id" | "createdAt"> }) => {
        if (db.logs.some((log) => log.userId === data.userId && log.dayKey === data.dayKey && log.slot === data.slot)) {
          throw new P.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        }
        const log = { ...data, id: `log-${db.logs.length + 1}`, createdAt: db.clock };
        db.logs.push(log);
        return { id: log.id };
      },
      delete: async ({ where }: { where: { id: string } }) => { db.logs = db.logs.filter((log) => log.id !== where.id); },
    },
  } };
});

const { runDailyExpiryEmails, sendTestExpiryEmail } = await import("./expiry-email.service.js");
const expiryRoutes = (await import("./expiry-email.routes.js")).default;

// Đồng hồ giả: 07:00 ngày 13/11/2026 giờ Việt Nam.
const at = (iso: string) => new Date(iso);
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const user = { email: "demo@nouri.vn", name: "Minh Anh", lockedAt: null };
const profile = (extra = {}) => ({ userId: "cm11111111111111111111111", expiryEmailDays: 2, user, ...extra });
const tofu = { id: "tofu", name: "Đậu hũ", quantity: 300, unit: "G", expiryDate: day("2026-11-14") };
const chicken = { id: "chicken", name: "Ức gà", quantity: 0.5, unit: "KG", expiryDate: day("2026-11-15") };
const rice = { id: "rice", name: "Gạo", quantity: 2, unit: "KG", expiryDate: day("2027-02-10") };
const recipes = { coldStart: false, items: [{ recipe: { id: "r1", name: "Đậu hũ sốt cà" }, reason: "Dùng Đậu hũ sắp hết hạn" }] };

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(db, { logs: [], pantry: [tofu, chicken, rice], profiles: [profile()], configured: true, clock: at("2026-11-13T00:00:00.000Z") });
  db.recommend.mockResolvedValue(recipes);
  db.findUser.mockResolvedValue(user);
  db.findProfile.mockResolvedValue({ expiryEmailDays: 2 });
  db.updateProfiles.mockResolvedValue({ count: 1 });
});

describe("pickExpiringItems", () => {
  const today = day("2026-11-13");
  const items = [
    tofu, chicken, rice,
    { id: "old", name: "Sữa", quantity: 1, unit: "L", expiryDate: day("2026-11-12") },
    { id: "empty", name: "Trứng", quantity: 0, unit: "ITEM", expiryDate: day("2026-11-13") },
    { id: "today", name: "Rau", quantity: 1, unit: "ITEM", expiryDate: day("2026-11-13") },
  ];

  it.each([
    [1, ["Rau", "Đậu hũ"]],
    [2, ["Rau", "Đậu hũ", "Ức gà"]],
    [3, ["Rau", "Đậu hũ", "Ức gà"]],
  ])("báo trước %i ngày → đúng món (bỏ đồ đã quá hạn, số lượng 0)", (days, names) => {
    expect(pickExpiringItems(items, days, today).map((item) => item.name)).toEqual(names);
  });

  it("món đã nhắc không nhắc lại, trừ khi hạn còn đúng 1 ngày; đổi hạn (mua mới) thì là món mới", () => {
    const reminded = new Set(["tofu:2026-11-14", "chicken:2026-11-15", "today:2026-11-13"]);
    expect(pickExpiringItems(items, 2, today, reminded).map((item) => item.name)).toEqual(["Đậu hũ"]);
    const rebought = [{ ...chicken, expiryDate: day("2026-11-14") }];
    expect(pickExpiringItems(rebought, 2, today, reminded)).toHaveLength(1);
  });

  it("token Tắt nhắc gắn với từng người; lịch 07:00 → cron", () => {
    const token = unsubscribeToken("user-a", secret);
    expect(isValidUnsubscribeToken("user-a", token, secret)).toBe(true);
    expect(isValidUnsubscribeToken("user-b", token, secret)).toBe(false);
    expect(isValidUnsubscribeToken("user-a", "sai", secret)).toBe(false);
    expect(cronExpressionOf("07:00")).toBe("0 7 * * *");
    expect(cronExpressionOf("18:30")).toBe("30 18 * * *");
  });
});

describe("runDailyExpiryEmails (transport giả lập, đồng hồ cố định)", () => {
  it("gửi một email: món sắp hết hạn + 3 món nên nấu từ gợi ý ngữ cảnh kho + Mở kho + Tắt nhắc", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await runDailyExpiryEmails(db.clock, send)).toMatchObject({ sent: 1 });
    expect(db.recommend).toHaveBeenCalledWith(profile().userId, { context: "pantry", limit: 3 }, db.clock);
    const mail = send.mock.calls[0][0];
    expect(mail).toMatchObject({ to: "demo@nouri.vn", subject: "Nouri: 2 thực phẩm sắp hết hạn" });
    expect(mail.text).toContain("- Đậu hũ (300 g): còn 1 ngày");
    expect(mail.text).toContain("- Ức gà (0.5 kg): còn 2 ngày");
    expect(mail.text).not.toContain("Gạo");
    expect(mail.text).toContain("Đậu hũ sốt cà: Dùng Đậu hũ sắp hết hạn http://localhost:8080/recipes/r1");
    expect(mail.text).toContain("Mở kho: http://localhost:8080/pantry");
    expect(mail.text).toContain(`/tat-nhac-han?u=${profile().userId}&t=${unsubscribeToken(profile().userId, secret)}`);
    expect(db.logs).toEqual([expect.objectContaining({ dayKey: "2026-11-13", slot: "daily", itemKeys: ["tofu:2026-11-14", "chicken:2026-11-15"] })]);
  });

  it("chạy lại trong ngày (hoặc hai tiến trình) → không gửi trùng", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await runDailyExpiryEmails(db.clock, send);
    expect(await runDailyExpiryEmails(at("2026-11-13T05:00:00.000Z"), send)).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("ngày hôm sau: không nhắc lại món đã nhắc, trừ món còn đúng 1 ngày; không còn món nào thì không gửi", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await runDailyExpiryEmails(db.clock, send);
    db.clock = at("2026-11-14T00:00:00.000Z");
    await runDailyExpiryEmails(db.clock, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].text).toContain("Ức gà (0.5 kg): còn 1 ngày");
    expect(send.mock.calls[1][0].text).not.toContain("- Đậu hũ (");
    db.clock = at("2026-11-15T00:00:00.000Z");
    expect(await runDailyExpiryEmails(db.clock, send)).toMatchObject({ sent: 0, noItems: 1 });
  });

  it("tài khoản bị khóa, chưa cấu hình SMTP → bỏ qua (ghi log), không gửi", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const send = vi.fn();
    db.profiles = [profile({ user: { ...user, lockedAt: new Date() } })];
    expect(await runDailyExpiryEmails(db.clock, send)).toMatchObject({ locked: 1, sent: 0 });
    db.configured = false;
    db.profiles = [profile()];
    expect(await runDailyExpiryEmails(db.clock, send)).toMatchObject({ skipped: "NO_SMTP" });
    expect(send).not.toHaveBeenCalled();
  });

  it("gửi lỗi → bỏ khóa để lần sau gửi lại", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runDailyExpiryEmails(db.clock, vi.fn().mockRejectedValue(new Error("SMTP down")))).toMatchObject({ failed: 1 });
    expect(db.logs).toEqual([]);
  });
});

describe("Gửi thử ngay, Tắt nhắc", () => {
  it("gửi thử tối đa 3 lần/ngày, không phụ thuộc nhắc hằng ngày", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await runDailyExpiryEmails(db.clock, send);
    for (let index = 0; index < 3; index += 1) await sendTestExpiryEmail(profile().userId, db.clock, send);
    expect(send).toHaveBeenCalledTimes(4);
    expect(send.mock.calls[3][0].text).toContain("- Đậu hũ (300 g)"); // bản thử lấy mọi món trong số ngày báo trước
    await expect(sendTestExpiryEmail(profile().userId, db.clock, send)).rejects.toMatchObject({ status: 429 });
  });

  it("kho không có món sắp hết hạn → 422, không tính lượt", async () => {
    db.pantry = [rice];
    await expect(sendTestExpiryEmail(profile().userId, db.clock, vi.fn())).rejects.toMatchObject({ status: 422 });
    expect(db.logs).toEqual([]);
  });

  it("Tắt nhắc một chạm: không cần đăng nhập, token đúng → tắt; token sai → 400", async () => {
    const app = testApp("/api/expiry-email", expiryRoutes);
    const userId = profile().userId;
    const ok = await request(app, "/api/expiry-email/unsubscribe", { method: "POST", body: { userId, token: unsubscribeToken(userId, secret) } });
    expect(ok.status).toBe(200);
    expect(db.updateProfiles).toHaveBeenCalledWith({ where: { userId }, data: { expiryEmailEnabled: false } });
    const bad = await request(app, "/api/expiry-email/unsubscribe", { method: "POST", body: { userId, token: unsubscribeToken("cm22222222222222222222222", secret) } });
    expect(bad.status).toBe(400);
    expect(db.updateProfiles).toHaveBeenCalledTimes(1);
  });

  it("Gửi thử cần đăng nhập", async () => {
    const app = testApp("/api/expiry-email", expiryRoutes);
    expect((await request(app, "/api/expiry-email/test", { method: "POST" })).status).toBe(401);
  });
});

// Giữ import Prisma để chắc lỗi P2002 giả lập đúng lớp mà service nhận diện.
void Prisma;
