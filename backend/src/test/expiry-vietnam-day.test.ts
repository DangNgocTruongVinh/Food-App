import { describe, expect, it } from "vitest";
import { buildPantryNotificationCandidates } from "../modules/notifications/notifications.service.js";
import { expiringFeature } from "../modules/recommendation/knowledge-based.js";
import { planConsumption } from "../services/pantry-consumption.js";
import { pantryExpiryState } from "../services/recipe-fit.service.js";
import { DAY_MS, vietnamDaysUntil, vietnamToday } from "../utils/vietnam-date.js";

// Audit H1: "hôm nay" của hạn dùng tính theo giờ Việt Nam (UTC+7), không theo ngày UTC. Hạn lưu "yyyy-MM-dd" → 00:00 UTC.
// Thực phẩm hết hạn ngày 24/11/2026; 17:00 UTC ngày 24/11 = 00:00 giờ VN ngày 25/11.
const expiry = new Date("2026-11-24T00:00:00.000Z");
const at = {
  lastMinute: new Date("2026-11-24T16:59:00.000Z"), // 23:59 giờ VN ngày 24/11
  midnight: new Date("2026-11-24T17:00:00.000Z"), // 00:00 giờ VN ngày 25/11
  oneAm: new Date("2026-11-24T18:00:00.000Z"), // 01:00 giờ VN ngày 25/11 (ngày UTC vẫn là 24/11)
  midMorning: new Date("2026-11-25T00:30:00.000Z"), // 07:30 giờ VN ngày 25/11
};

const tofu = { id: "dau-hu", name: "Đậu hũ", quantity: 300, unit: "G" as const, expiryDate: expiry };
const ingredient = { id: "i1", name: "Đậu hũ", quantity: 100, unit: "G" as const, optional: false };
const consume = (now: Date) => planConsumption([ingredient], 1, 1, [tofu], now)[0];
const fHan = (now: Date) => expiringFeature({ ingredients: [{ name: "Đậu hũ", quantity: 100, unit: "G" }] }, [tofu], now);
const notify = (now: Date) => buildPantryNotificationCandidates([{
  id: "dau-hu", userId: "u1", name: "Đậu hũ", quantity: 300, minimumStock: 0, expiryDate: expiry, updatedAt: expiry,
}], now);

describe("Hạn dùng theo ngày giờ Việt Nam (audit H1)", () => {
  it("vietnamDaysUntil: đổi ngày lúc 00:00 giờ VN, không phải 00:00 UTC", () => {
    expect(vietnamDaysUntil(expiry, at.lastMinute)).toBe(0);
    expect(vietnamDaysUntil(expiry, at.midnight)).toBe(-1);
    expect(vietnamDaysUntil(expiry, at.oneAm)).toBe(-1);
    expect(vietnamDaysUntil(expiry, at.midMorning)).toBe(-1);
  });

  it("vietnamDaysUntil (độ lệch +7 giờ) khớp vietnamToday (Intl) ở mọi giờ, mọi phút lẻ trong 3 ngày", () => {
    for (let minutes = 0; minutes < 3 * 24 * 60; minutes += 17) {
      const now = new Date(Date.UTC(2026, 10, 23) + minutes * 60_000);
      expect(vietnamDaysUntil(expiry, now)).toBe(Math.round((expiry.getTime() - vietnamToday(now).getTime()) / DAY_MS));
    }
  });

  it("23:59 giờ VN ngày 24/11: còn \"expiring\", được trừ kho, được cộng f_hạn, thông báo \"hết hạn hôm nay\"", () => {
    expect(pantryExpiryState(expiry, at.lastMinute)).toBe("expiring");
    expect(consume(at.lastMinute)).toMatchObject({ status: "ENOUGH", deductions: [{ pantryItemId: "dau-hu", quantity: 100 }] });
    expect(fHan(at.lastMinute)).toEqual({ value: 1, names: ["Đậu hũ"] });
    expect(notify(at.lastMinute)).toMatchObject([{ type: "PANTRY_EXPIRING", message: "Đậu hũ sẽ hết hạn hôm nay." }]);
  });

  it("00:00 giờ VN ngày 25/11: \"expired\"", () => {
    expect(pantryExpiryState(expiry, at.midnight)).toBe("expired");
  });

  // Trước khi sửa: 18:00 UTC vẫn là ngày 24/11 theo UTC nên thực phẩm bị coi "expiring", bị trừ và được cộng điểm.
  it.each([["01:00 giờ VN", at.oneAm], ["07:30 giờ VN", at.midMorning]])(
    "%s ngày 25/11: \"expired\", không bị trừ khi \"Đã ăn\", không được cộng f_hạn, thông báo đã hết hạn đúng ngày",
    (_label, now) => {
      expect(pantryExpiryState(expiry, now)).toBe("expired");
      expect(consume(now)).toMatchObject({ status: "EXPIRED_ONLY", deductions: [] });
      expect(fHan(now)).toEqual({ value: 0, names: [] });
      expect(notify(now)).toMatchObject([{
        type: "PANTRY_EXPIRED", message: "Đậu hũ đã hết hạn. Hãy kiểm tra trước khi sử dụng.", dedupeKey: "pantry-expired:dau-hu:2026-11-24",
      }]);
    },
  );
});
