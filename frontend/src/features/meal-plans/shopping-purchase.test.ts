import { describe, expect, it } from "vitest";
import type { ShoppingPurchaseResult } from "../../types";
import { purchaseNotice, unpurchaseNotice } from "./shopping-purchase.logic";

const base: ShoppingPurchaseResult = {
  id: "s1", name: "Đậu hũ", quantity: 300, unit: "G", purchased: true, category: "Đậu & hạt", alreadyPurchased: false, pantry: null, restoration: null,
};
const added = (patch: Partial<NonNullable<ShoppingPurchaseResult["pantry"]>>): ShoppingPurchaseResult => ({
  ...base,
  pantry: {
    action: "CREATED", pantryItemId: "p1", name: "Đậu hũ", quantity: 300, unit: "G", quantityAfter: 300,
    expiryDate: "2026-11-06T00:00:00.000Z", expiryEstimated: true, ...patch,
  },
});

describe("Notice after ticking \"Đã mua\"", () => {
  it("says what was added, how, and the estimated expiry; keeps the pantry item id for \"Sửa\"", () => {
    expect(purchaseNotice(added({}))).toEqual({
      kind: "added", message: "Đã thêm 300 g Đậu hũ vào kho (thực phẩm mới, hạn ước tính 06/11/2026).", pantryItemId: "p1",
    });
    expect(purchaseNotice(added({ action: "REUSED" })).message).toBe("Đã thêm 300 g Đậu hũ vào kho (dùng lại thực phẩm đã dùng hết, hạn ước tính 06/11/2026).");
    expect(purchaseNotice(added({ action: "MERGED", unit: "KG", quantity: 0.3, quantityAfter: 1.2, expiryEstimated: false })).message)
      .toBe("Đã thêm 300 g Đậu hũ vào kho (cộng vào thực phẩm sẵn có, nay còn 1,2 kg).");
    expect(purchaseNotice(added({ name: "Đá viên", expiryDate: null, expiryEstimated: false })).message).toBe("Đã thêm 300 g Đá viên vào kho (thực phẩm mới).");
  });

  it("does not claim a change when the line was already purchased", () => {
    expect(purchaseNotice({ ...base, alreadyPurchased: true })).toEqual({
      kind: "added", message: "Đậu hũ đã được đánh dấu đã mua trước đó, kho không đổi.", pantryItemId: null,
    });
  });
});

describe("Notice after unticking \"Đã mua\"", () => {
  it("lists removed and subtracted items and what could not be taken back", () => {
    const result: ShoppingPurchaseResult = {
      ...base, purchased: false,
      restoration: {
        restored: [
          { pantryItemId: "p1", name: "Đậu hũ", quantity: 300, unit: "G", quantityAfter: 0, removed: true },
          { pantryItemId: "p2", name: "Gạo", quantity: 0.5, unit: "KG", quantityAfter: 1, removed: false },
        ],
        skipped: [
          { itemName: "Ức gà", quantity: 200, unit: "G", reason: "INSUFFICIENT" },
          { itemName: "Trứng", quantity: 4, unit: "ITEM", reason: "DELETED" },
        ],
      },
    };
    expect(unpurchaseNotice(result)).toEqual({
      kind: "restored",
      pantryItemId: null,
      message: "Đã bỏ đánh dấu đã mua: Đậu hũ. Đã xóa 300 g Đậu hũ khỏi kho (thực phẩm do lần mua này thêm vào). Đã trừ lại 500 g Gạo khỏi kho. "
        + "Không trừ lại được 200 g Ức gà (kho không còn đủ, có thể đã dùng một phần), 4 cái Trứng (thực phẩm đã bị xóa khỏi kho).",
    });
  });

  it("says the pantry did not change when nothing had been added", () => {
    expect(unpurchaseNotice({ ...base, purchased: false, restoration: { restored: [], skipped: [] } }).message).toBe("Đã bỏ đánh dấu đã mua: Đậu hũ. Kho không đổi.");
  });
});
