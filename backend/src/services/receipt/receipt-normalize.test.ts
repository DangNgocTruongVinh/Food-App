import { describe, expect, it } from "vitest";
import { buildNameIndex, canonicalFoodName, normalizeReceiptItems, type NormalizeContext } from "./receipt-normalize.js";
import type { RawReceiptItem } from "./receipt-types.js";

const now = new Date("2026-11-09T03:00:00.000Z"); // 10:00 giờ Việt Nam
const raw = (overrides: Partial<RawReceiptItem>): RawReceiptItem => ({
  rawText: overrides.name ?? "", name: "", quantity: 1, unit: "ITEM", unitPrice: null, price: 10000,
  expiryDate: null, confidence: null, consistent: null, ...overrides,
});
const context = (overrides: Partial<NormalizeContext> = {}): NormalizeContext => ({
  pantry: [], knownNames: ["Thịt heo xay", "Rau muống", "Cà chua", "Cá basa", "Sữa tươi", "Trứng gà"], allergies: [], dislikedFoods: [], now,
  ...overrides,
});

describe("canonicalFoodName", () => {
  const index = buildNameIndex(["Trứng gà ta"], ["Thịt heo xay", "Rau muống", "Cà tím", "Cá tím"]);

  it("tên không dấu viết hoa → tên có dấu đã biết", () => {
    expect(canonicalFoodName("THIT HEO XAY", index)).toEqual({ name: "Thịt heo xay", matched: true });
  });

  it("tên bắt đầu bằng tên đã biết (theo nguyên từ) → tên đã biết", () => {
    expect(canonicalFoodName("RAU MUONG VIETGAP", index)).toEqual({ name: "Rau muống", matched: true });
    expect(canonicalFoodName("Rau muốngxx", index).matched).toBe(false);
  });

  it("ưu tiên tên trong kho của người dùng", () => {
    expect(canonicalFoodName("TRUNG GA TA", index)).toEqual({ name: "Trứng gà ta", matched: true });
  });

  it("bảng viết tắt hóa đơn: tên gọi khác", () => {
    expect(canonicalFoodName("DAU PHU NON", index)).toEqual({ name: "Đậu hũ", matched: true });
    expect(canonicalFoodName("XI DAU", index)).toEqual({ name: "Nước tương", matched: true });
  });

  it("tên bỏ dấu trùng nhau (cà tím/cá tím) thì không đoán; tên có dấu đúng thì vẫn nhận", () => {
    expect(canonicalFoodName("CA TIM", index)).toEqual({ name: "Ca tim", matched: false });
    expect(canonicalFoodName("Cà tím", index)).toEqual({ name: "Cà tím", matched: true });
  });

  it("không khớp: giữ tên đọc được, viết hoa toàn bộ thì về chữ thường", () => {
    expect(canonicalFoodName("BANH QUY BO", index)).toEqual({ name: "Banh quy bo", matched: false });
    expect(canonicalFoodName("Bánh quy bơ", index)).toEqual({ name: "Bánh quy bơ", matched: false });
  });
});

describe("normalizeReceiptItems", () => {
  it("nhóm, nơi bảo quản, hạn ước tính theo nhóm (tính từ hôm nay giờ Việt Nam)", () => {
    const [line] = normalizeReceiptItems([raw({ name: "THIT HEO XAY", quantity: 0.5, unit: "KG" })], context());
    expect(line).toMatchObject({
      key: "l1", name: "Thịt heo xay", quantity: 0.5, unit: "KG", category: "Thịt & cá", storageLocation: "REFRIGERATOR",
      expiryDate: "2026-11-11", expiryEstimated: true, target: { kind: "create" }, flags: [],
    });
  });

  it("hạn đọc được trên nhãn thì dùng, không đánh dấu ước tính", () => {
    const [line] = normalizeReceiptItems([raw({ name: "Sữa tươi", quantity: 1, unit: "L", expiryDate: "2027-05-01" })], context());
    expect(line).toMatchObject({ expiryDate: "2027-05-01", expiryEstimated: false, category: "Trứng & sữa" });
  });

  it("thiếu số lượng/đơn vị: đoán và gắn cờ; số lẻ không đơn vị là kg", () => {
    const [guessed, weighed] = normalizeReceiptItems([
      raw({ name: "Rau muống", quantity: null, unit: null }), raw({ name: "Cá basa", quantity: 0.75, unit: null }),
    ], context());
    expect(guessed).toMatchObject({ quantity: 1, unit: "ITEM", flags: ["QUANTITY_GUESSED", "UNIT_GUESSED"] });
    expect(weighed).toMatchObject({ quantity: 0.75, unit: "KG", flags: ["UNIT_GUESSED"] });
  });

  it("cờ tên không khớp, lệch giá, độ tin cậy thấp", () => {
    const [line] = normalizeReceiptItems([raw({ name: "XYZ ABC", consistent: false, confidence: 41 })], context());
    expect(line.flags).toEqual(["NAME_UNMATCHED", "PRICE_MISMATCH", "LOW_CONFIDENCE"]);
  });

  it("đích trong kho như \"Đã mua\": cộng vào thực phẩm cùng tên còn hạn (đơn vị quy đổi được)", () => {
    const pantry = [{ id: "p1", name: "Trứng gà", quantity: 4, unit: "ITEM" as const, expiryDate: new Date("2026-11-20T00:00:00.000Z") }];
    const [line] = normalizeReceiptItems([raw({ name: "TRUNG GA", quantity: 10, unit: "ITEM" })], context({ pantry }));
    expect(line.target).toEqual({ kind: "merge", pantryItemId: "p1", name: "Trứng gà", quantity: 4, unit: "ITEM" });
  });

  it("cảnh báo dị ứng theo nhóm và món không thích (chỉ gắn nhãn)", () => {
    const [milk, fish] = normalizeReceiptItems([raw({ name: "SUA TUOI" }), raw({ name: "Cá basa" })],
      context({ allergies: ["Sữa"], dislikedFoods: ["cá basa"] }));
    expect(milk.warnings).toEqual([{ kind: "ALLERGY", term: "sữa tươi" }]);
    expect(fish.warnings).toEqual([{ kind: "DISLIKED", term: "cá basa" }]);
  });
});
