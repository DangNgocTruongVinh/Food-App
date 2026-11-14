import type { ReceiptSkipReason } from "./receipt-types.js";

/**
 * Danh mục đọc hóa đơn: tên viết tắt (ReceiptAbbreviation) và từ khóa nhận dòng không phải hàng (ReceiptSkipKeyword). Chỉ có
 * LOGIC; dữ liệu nằm trong database, nạp bằng setReceiptCatalog (services/catalog/catalog.service.ts). Chưa nạp thì báo lỗi.
 */
export type ReceiptKeywordMatch = "WORD" | "PREFIX" | "LINE" | "LINE_SUFFIX";
export type ReceiptSkipKeywordEntry = { reason: ReceiptSkipReason; keyword: string; matchMode: ReceiptKeywordMatch };
export type ReceiptCatalog = {
  /** [tên trên hóa đơn đã bỏ dấu, tên thực phẩm có dấu]. */
  abbreviations: Array<[string, string]>;
  /** Theo thứ tự xét lý do (thuế, giảm giá trước tổng tiền). */
  skipKeywords: ReceiptSkipKeywordEntry[];
};

let catalog: ReceiptCatalog | null = null;
let rules: Array<[ReceiptSkipReason, RegExp]> | null = null;

export function setReceiptCatalog(next: ReceiptCatalog) {
  catalog = next;
  rules = null;
}

function receiptCatalog() {
  if (!catalog) throw new Error("Chưa nạp danh mục hóa đơn (setReceiptCatalog).");
  return catalog;
}

export const receiptAbbreviations = () => receiptCatalog().abbreviations;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternatives = (words: string[]) => words.map(escape).join("|");

/**
 * Mỗi lý do → một biểu thức (so trên chữ đã bỏ dấu, bỏ số): WORD = có nguyên từ ở bất kỳ đâu, PREFIX = dòng bắt đầu bằng,
 * LINE = cả dòng là từ này, có thể kèm các từ LINE_SUFFIX cùng lý do ("tui", "tui nilon nho"). Giữ thứ tự lý do của danh mục.
 */
export function skipRules(): Array<[ReceiptSkipReason, RegExp]> {
  if (rules) return rules;
  const byReason = new Map<ReceiptSkipReason, ReceiptSkipKeywordEntry[]>();
  for (const entry of receiptCatalog().skipKeywords) byReason.set(entry.reason, [...(byReason.get(entry.reason) ?? []), entry]);
  rules = [...byReason].map(([reason, entries]) => {
    const of = (mode: ReceiptKeywordMatch) => entries.filter((entry) => entry.matchMode === mode).map((entry) => entry.keyword);
    const [word, prefix, line, suffix] = [of("WORD"), of("PREFIX"), of("LINE"), of("LINE_SUFFIX")];
    const parts = [
      word.length ? `\\b(${alternatives(word)})\\b` : "",
      prefix.length ? `^(${alternatives(prefix)})\\b` : "",
      line.length ? `^(${alternatives(line)})${suffix.length ? `( (${alternatives(suffix)}))*` : ""}$` : "",
    ].filter(Boolean);
    return [reason, new RegExp(parts.join("|"))] as [ReceiptSkipReason, RegExp];
  });
  return rules;
}
