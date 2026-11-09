import { describe, expect, it } from "vitest";
import { matchItems, nameSimilarity, scoreReceipt, summarizeScores } from "./receipt-eval.js";

describe("receipt-eval", () => {
  it("độ giống tên bỏ dấu, chịu lỗi OCR vài ký tự", () => {
    expect(nameSimilarity("Thịt heo xay", "THIT HEO XAY")).toBe(1);
    expect(nameSimilarity("Thịt heo xay", "THIT HE0 XAY")).toBeGreaterThan(0.7);
    expect(nameSimilarity("Thịt heo xay", "Rau muống")).toBeLessThan(0.3);
  });

  it("ghép tham lam từ cặp giống nhất, mỗi dòng dùng một lần", () => {
    const pairs = matchItems(
      [{ name: "Trứng gà", quantity: 10, unit: "ITEM" }, { name: "Trứng vịt", quantity: 6, unit: "ITEM" }],
      [{ name: "Trứng vịt", quantity: 6, unit: "ITEM" }, { name: "Trứng gà", quantity: 10, unit: "ITEM" }],
    );
    expect(pairs.map(({ predicted, expected }) => [predicted.name, expected.name])).toEqual([["Trứng gà", "Trứng gà"], ["Trứng vịt", "Trứng vịt"]]);
  });

  it("đơn vị cùng nhóm và số lượng sau quy đổi; dòng rác làm giảm precision", () => {
    const score = scoreReceipt(
      [
        { name: "Thịt heo xay", quantity: 500, unit: "G" }, { name: "Rau muong", quantity: 2, unit: "ITEM" },
        { name: "Sữa tươi", quantity: 4, unit: "PACKAGE" }, { name: "Siêu thị ABC", quantity: 1, unit: "ITEM" },
      ],
      [
        { name: "Thịt heo xay", quantity: 0.5, unit: "KG" }, { name: "Rau muống", quantity: 1, unit: "ITEM" },
        { name: "Sữa tươi", quantity: 720, unit: "ML" },
      ],
    );
    expect(score).toEqual({ expected: 3, predicted: 4, matched: 3, nameExact: 3, unitOk: 2, quantityOk: 1 });
    expect(summarizeScores([score])).toMatchObject({ precision: 0.75, recall: 1, nameRate: 1, quantityRate: 1 / 3 });
  });
});
