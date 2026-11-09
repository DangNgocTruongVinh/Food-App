import type { FoodUnit } from "@prisma/client";
import { canConvertUnit, convertQuantity } from "../../utils/food-units.js";
import { foldText } from "./receipt-text.js";

// Chấm điểm quét hóa đơn so với đáp án (docs/test-evidence/receipts/rNN.json), dùng cho scripts/eval-receipt-ocr.ts.
// Ghép dòng dự đoán ↔ dòng đáp án theo độ giống tên (bỏ dấu, bigram Dice), tham lam từ cặp giống nhất, ngưỡng MATCH_THRESHOLD.
// Tên đúng: trùng hẳn sau khi bỏ dấu. Đơn vị đúng: cùng nhóm quy đổi (500 g ≈ 0,5 kg). Số lượng đúng: lệch ≤ 1 % sau quy đổi.

export type AnswerItem = { name: string; quantity: number; unit: FoodUnit; price?: number | null; expiryDate?: string | null };
export type ReceiptAnswer = { id: string; kind?: "receipt" | "label"; store?: string; note?: string; items: AnswerItem[]; ignored?: string[] };
export type PredictedItem = { name: string; quantity: number; unit: FoodUnit };

export const MATCH_THRESHOLD = 0.5;

const bigrams = (value: string) => {
  const text = ` ${foldText(value)} `;
  const grams = new Map<string, number>();
  for (let index = 0; index < text.length - 1; index += 1) {
    const gram = text.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
};

/** Độ giống hai tên 0–1 (Dice trên cặp ký tự liên tiếp, đã bỏ dấu): chịu được lỗi OCR một vài ký tự. */
export function nameSimilarity(a: string, b: string) {
  const [x, y] = [bigrams(a), bigrams(b)];
  let common = 0;
  for (const [gram, count] of x) common += Math.min(count, y.get(gram) ?? 0);
  const total = [...x.values(), ...y.values()].reduce((sum, count) => sum + count, 0);
  return total ? (2 * common) / total : 0;
}

export function matchItems(predicted: PredictedItem[], expected: AnswerItem[]) {
  const candidates = predicted.flatMap((p, pi) => expected.map((e, ei) => ({ pi, ei, score: nameSimilarity(p.name, e.name) })))
    .filter((pair) => pair.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.pi - b.pi || a.ei - b.ei);
  const [usedP, usedE] = [new Set<number>(), new Set<number>()];
  const pairs: Array<{ predicted: PredictedItem; expected: AnswerItem }> = [];
  for (const { pi, ei } of candidates) {
    if (usedP.has(pi) || usedE.has(ei)) continue;
    usedP.add(pi);
    usedE.add(ei);
    pairs.push({ predicted: predicted[pi], expected: expected[ei] });
  }
  return pairs;
}

export type ReceiptScore = { expected: number; predicted: number; matched: number; nameExact: number; unitOk: number; quantityOk: number };

export function scoreReceipt(predicted: PredictedItem[], expected: AnswerItem[]): ReceiptScore {
  const pairs = matchItems(predicted, expected);
  const unitOk = pairs.filter(({ predicted: p, expected: e }) => canConvertUnit(p.unit, e.unit));
  return {
    expected: expected.length,
    predicted: predicted.length,
    matched: pairs.length,
    nameExact: pairs.filter(({ predicted: p, expected: e }) => foldText(p.name) === foldText(e.name)).length,
    unitOk: unitOk.length,
    quantityOk: unitOk.filter(({ predicted: p, expected: e }) => {
      const value = convertQuantity(p.quantity, p.unit, e.unit);
      return value !== null && Math.abs(value - e.quantity) <= Math.max(1e-9, e.quantity * 0.01);
    }).length,
  };
}

const ratio = (part: number, whole: number) => (whole ? part / whole : 0);

/** Cộng dồn nhiều hóa đơn. Tỉ lệ tên/đơn vị/số lượng tính trên số dòng đáp án (đúng từ đầu đến cuối). */
export function summarizeScores(scores: ReceiptScore[]) {
  const total = scores.reduce((sum, score) => ({
    expected: sum.expected + score.expected, predicted: sum.predicted + score.predicted, matched: sum.matched + score.matched,
    nameExact: sum.nameExact + score.nameExact, unitOk: sum.unitOk + score.unitOk, quantityOk: sum.quantityOk + score.quantityOk,
  }), { expected: 0, predicted: 0, matched: 0, nameExact: 0, unitOk: 0, quantityOk: 0 });
  const precision = ratio(total.matched, total.predicted);
  const recall = ratio(total.matched, total.expected);
  return {
    ...total, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    nameRate: ratio(total.nameExact, total.expected), unitRate: ratio(total.unitOk, total.expected), quantityRate: ratio(total.quantityOk, total.expected),
  };
}
