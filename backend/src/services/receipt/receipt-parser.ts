import type { FoodUnit } from "@prisma/client";
import { foldText } from "./receipt-text.js";
import type { OcrLine, OcrOutput, ParsedReceipt, RawReceiptItem, ReceiptSkipReason, SkippedReceiptLine } from "./receipt-types.js";
import { skipRules } from "./receipt-catalog.js";

// Bộ phân tích dòng hóa đơn theo quy tắc (GĐ3c), dùng chung cho mọi nhà cung cấp OCR. Đầu vào là các dòng chữ; đầu ra là
// dòng hàng (tên, số lượng, đơn vị, đơn giá, thành tiền, hạn đọc được) và các dòng bị bỏ kèm lý do (vẫn hiện ở màn duyệt).
// Các dạng dòng hàng nhận được:
//   "Thịt heo xay 0,5 kg 130.000 65.000"   "Trứng gà 10 3.200 32.000"   "Rau muống 1 bó 8.000"   "Bánh mì 2 x 15.000"
//   hai dòng: "THIT HEO XAY" / "0.512 x 129.000 66.048"   "Sữa tươi 180ml" / "SL: 4  ĐG: 8.500  TT: 34.000"

// Đơn vị viết trên hóa đơn (đã bỏ dấu) → FoodUnit. "bó", "quả", "con"… là cái; "hộp", "chai", "vỉ"… là gói.
const UNIT_WORDS: Record<string, FoodUnit> = {
  kg: "KG", kgs: "KG", ki: "KG", ky: "KG", kilo: "KG",
  g: "G", gr: "G", grs: "G", gam: "G", gram: "G",
  l: "L", lit: "L", ltr: "L", ml: "ML",
  cai: "ITEM", chiec: "ITEM", qua: "ITEM", trai: "ITEM", con: "ITEM", bo: "ITEM", cu: "ITEM", cay: "ITEM", bap: "ITEM",
  pcs: "ITEM", pc: "ITEM", ea: "ITEM",
  goi: "PACKAGE", hop: "PACKAGE", chai: "PACKAGE", lon: "PACKAGE", vi: "PACKAGE", bich: "PACKAGE", khay: "PACKAGE",
  hu: "PACKAGE", lo: "PACKAGE", thung: "PACKAGE", tui: "PACKAGE", pack: "PACKAGE", pkg: "PACKAGE",
};
const MEASURED: FoodUnit[] = ["G", "KG", "ML", "L"];

const EXPIRY_KEYWORD = /\b(hsd|han su dung|han dung|han sd|exp|expiry|exp date|best before|bbd|use by)\b/;
const PRODUCTION_KEYWORD = /\b(nsx|ngay san xuat|mfg|mfd)\b/;
const NET_KEYWORD = /\b(khoi luong tinh|kl tinh|klt|trong luong tinh|khoi luong|net wt|netwt|net weight|dung tich|the tich)\b/;
const CONTINUATION_LABELS = /(?<![\p{L}])(S\.?L|Số lượng|So luong|ĐG|DG|Đơn giá|Don gia|TT|Thành tiền|Thanh tien)(?![\p{L}])\s*[:.]?/giu;
const TIME = /\b\d{1,2}:\d{2}\b/;
const DATE = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})|(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})|(?<![\d/.-])(\d{1,2})[/.-](\d{4})(?![\d/.-])/;

type Num = { raw: string; candidates: number[]; unit: FoodUnit | null; glued: boolean };
type Token = { kind: "word"; raw: string } | { kind: "num"; raw: string; num: Num } | { kind: "x"; raw: string };

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Các cách hiểu một chuỗi số trên hóa đơn: "15.000"/"15,000" có thể là 15000 (đồng) hoặc 15 (số lượng); "0,512" chỉ là 0,512;
 * "1.234.567" là 1234567. Cách hiểu đúng được chọn sau bằng phép thử SL × đơn giá = thành tiền.
 */
export function numberCandidates(raw: string): number[] {
  const text = raw.replace(/(vnđ|vnd|đ|d)$/i, "").replace(/[.,]+$/, "");
  if (/^\d+$/.test(text)) return [Number(text)];
  if (!/^\d[\d.,]*$/.test(text)) return [];
  if (text.includes(".") && text.includes(",")) {
    // "1.234,5" hoặc "1,234.5": dấu cuối là dấu thập phân.
    const last = Math.max(text.lastIndexOf("."), text.lastIndexOf(","));
    return [Number(`${text.slice(0, last).replace(/[.,]/g, "")}.${text.slice(last + 1)}`)];
  }
  const groups = text.split(/[.,]/);
  if (groups.length > 2) return groups.slice(1).every((group) => group.length === 3) ? [Number(groups.join(""))] : [];
  const [whole, fraction] = groups;
  const decimal = Number(`${whole}.${fraction}`);
  return fraction.length === 3 && !whole.startsWith("0") ? [decimal, Number(whole + fraction)] : [decimal];
}

const moneyValue = (num: Num) => {
  const integers = num.candidates.filter((value) => Number.isInteger(value) && value >= 100);
  return integers.length ? Math.max(...integers) : null;
};
const quantityValue = (num: Num) => Math.min(...num.candidates);
const looksLikeMoney = (num: Num) => !num.unit && (/(đ|vnd|vnđ)$/i.test(num.raw) || (moneyValue(num) ?? 0) >= 1000);
const plainSmallInteger = (num: Num) => !num.unit && /^\d{1,3}$/.test(num.raw);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(50, b * 0.01);

/** Sửa lỗi OCR thường gặp trong số: "1O.000" → "10.000", "l5.000" → "15.000" (chỉ khi chuỗi gần như toàn chữ số). */
const fixDigits = (piece: string) =>
  /^[\dOoIl.,]+(đ|d)?$/.test(piece) && (piece.match(/\d/g)?.length ?? 0) >= 2 ? piece.replace(/[Oo]/g, "0").replace(/[Il]/g, "1") : piece;

function tokenize(text: string): Token[] {
  const spaced = text.replace(/[×*]/g, " x ").replace(/=/g, " ").replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1 x ");
  const tokens: Token[] = [];
  for (const rawPiece of spaced.split(/\s+/)) {
    const piece = fixDigits(rawPiece.replace(/^[:;()[\]"'#]+|[:;()[\]"']+$/g, ""));
    if (!piece) continue;
    const folded = foldText(piece);
    if (folded === "x") {
      tokens.push({ kind: "x", raw: piece });
      continue;
    }
    if (/^\d[\d.,]*(vnđ|vnd|đ|d)?$/i.test(piece)) {
      if (/^\d{8,}$/.test(piece)) continue; // mã vạch, mã hàng
      const candidates = numberCandidates(piece);
      if (candidates.length) tokens.push({ kind: "num", raw: piece, num: { raw: piece, candidates, unit: null, glued: false } });
      continue;
    }
    const glued = /^(\d[\d.,]*)(\p{L}+)\.?$/u.exec(piece);
    if (glued && UNIT_WORDS[foldText(glued[2])]) {
      const candidates = numberCandidates(glued[1]);
      if (candidates.length) {
        tokens.push({ kind: "num", raw: piece, num: { raw: glued[1], candidates, unit: UNIT_WORDS[foldText(glued[2])], glued: true } });
        continue;
      }
    }
    const previous = tokens.at(-1);
    const unit = UNIT_WORDS[folded];
    if (unit && previous?.kind === "num" && !previous.num.unit) {
      previous.num.unit = unit;
      previous.raw = `${previous.raw} ${piece}`;
      continue;
    }
    tokens.push({ kind: "word", raw: piece });
  }
  return tokens;
}

type Amounts = Pick<RawReceiptItem, "quantity" | "unit" | "unitPrice" | "price" | "consistent">;

/** Hiểu phần số cuối dòng: [SL][đơn vị] [x] [đơn giá] [thành tiền]. */
function solveAmounts(nums: Num[], multiplied: boolean): Amounts {
  const empty: Amounts = { quantity: null, unit: null, unitPrice: null, price: null, consistent: null };
  if (!nums.length) return empty;
  if (nums.length === 1) {
    const [only] = nums;
    if (only.unit) return { ...empty, quantity: quantityValue(only), unit: only.unit };
    if (looksLikeMoney(only)) return { ...empty, price: moneyValue(only) };
    return { ...empty, quantity: quantityValue(only) };
  }
  if (nums.length === 2) {
    const [first, second] = nums;
    const secondMoney = moneyValue(second);
    if (first.unit || plainSmallInteger(first) || !looksLikeMoney(first)) {
      const quantity = quantityValue(first);
      if (multiplied && secondMoney !== null) {
        return { quantity, unit: first.unit, unitPrice: secondMoney, price: Math.round(quantity * secondMoney), consistent: null };
      }
      return { quantity, unit: first.unit, unitPrice: null, price: secondMoney, consistent: null };
    }
    const unitPrice = moneyValue(first);
    if (unitPrice && secondMoney && secondMoney >= unitPrice) {
      const ratio = secondMoney / unitPrice;
      if (ratio <= 100 && Math.abs(ratio - round3(ratio)) < 1e-9) {
        return { quantity: round3(ratio), unit: null, unitPrice, price: secondMoney, consistent: true };
      }
    }
    return { ...empty, price: secondMoney };
  }
  const [first, second, third] = nums.slice(-3);
  const quantities = [...first.candidates].sort((a, b) => a - b);
  const unitPrices = second.candidates.filter((value) => value >= 100).sort((a, b) => b - a);
  const totals = [...third.candidates].sort((a, b) => b - a);
  for (const quantity of quantities) {
    for (const unitPrice of unitPrices) {
      const total = totals.find((value) => close(quantity * unitPrice, value));
      if (total !== undefined) return { quantity, unit: first.unit, unitPrice, price: total, consistent: true };
    }
  }
  return { quantity: quantityValue(first), unit: first.unit, unitPrice: moneyValue(second), price: moneyValue(third), consistent: false };
}

const cleanName = (value: string) => value.replace(/^[\s\-–:*.#,]+|[\s\-–:*.#,]+$/g, "").replace(/\s+/g, " ");
const letterCount = (value: string) => value.match(/\p{L}/gu)?.length ?? 0;

/** Một dòng hàng (có thể là hai dòng đã ghép). null: phần tên không đủ chữ. */
export function parseItemLine(text: string, confidence: number | null = null): RawReceiptItem | null {
  const rest = text.normalize("NFC").replace(/^\s*\d{6,14}\s+/, "").replace(/^\s*\d{1,3}\s*[.)/-]\s*(?=\p{L})/u, "");
  const tokens = tokenize(rest.replace(CONTINUATION_LABELS, " "));
  let tailStart = tokens.length;
  while (tailStart > 0 && tokens[tailStart - 1].kind !== "word") tailStart -= 1;
  const nameTokens = tokens.slice(0, tailStart);
  let tail = tokens.slice(tailStart);
  // "Sữa tươi 180ml 4 8.500 34.000": dung tích dính số đứng đầu phần số, sau còn SL → là quy cách trong tên, không phải SL.
  const head = tail.find((token) => token.kind === "num");
  const tailNums = () => tail.flatMap((token) => (token.kind === "num" ? [token.num] : []));
  // "Thịt bò 1.25KG 100.000 125.000" thì 1.25KG là SL: sau nó chỉ còn đơn giá và thành tiền.
  const afterHead = tailNums().slice(1);
  const sizeFirst = afterHead.length >= 3 || (afterHead.length === 2 && !looksLikeMoney(afterHead[0]));
  if (head?.kind === "num" && head.num.glued && head.num.unit && MEASURED.includes(head.num.unit) && sizeFirst) {
    nameTokens.push(head);
    tail = tail.slice(tail.indexOf(head) + 1);
  }
  const nums = tailNums();
  const xIndex = tail.findIndex((token) => token.kind === "x");
  const multiplied = xIndex > 0 && tail.slice(xIndex + 1).filter((token) => token.kind === "num").length === 1;
  const amounts = solveAmounts(nums, multiplied);

  // Quy cách trong tên ("Sữa tươi 180ml" × 4 hộp) → tổng lượng 720 ml, tên bỏ quy cách (khớp kho và công thức theo ml).
  let sizeIndex = -1;
  nameTokens.forEach((token, index) => {
    if (token.kind === "num" && token.num.glued && token.num.unit && MEASURED.includes(token.num.unit)) sizeIndex = index;
  });
  const countable = amounts.unit === null || amounts.unit === "ITEM" || amounts.unit === "PACKAGE";
  if (sizeIndex >= 0 && countable && (amounts.quantity === null || Number.isInteger(amounts.quantity))) {
    const size = nameTokens[sizeIndex] as Extract<Token, { kind: "num" }>;
    amounts.quantity = round3((amounts.quantity ?? 1) * quantityValue(size.num));
    amounts.unit = size.num.unit;
    nameTokens.splice(sizeIndex, 1);
  }
  const name = cleanName(nameTokens.map((token) => token.raw).join(" "));
  if (letterCount(name) < 2) return null;
  if (amounts.quantity !== null && (amounts.quantity <= 0 || amounts.quantity > 1000)) amounts.quantity = null;
  return { rawText: text.trim(), name, ...amounts, expiryDate: null, confidence };
}

/** "HSD: 20/12/26", "EXP 2026-12-20", "HSD 12/2026" (→ ngày cuối tháng) → "yyyy-MM-dd"; ngày không hợp lệ → null. */
export function parseReceiptDate(text: string): string | null {
  const match = DATE.exec(text);
  if (!match) return null;
  let [day, month, year] = match[1]
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : match[4] ? [Number(match[6]), Number(match[5]), Number(match[4])] : [0, Number(match[7]), Number(match[8])];
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  if (day === 0) day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** Lý do bỏ một dòng không phải hàng (tổng tiền, thuế, thanh toán, đầu/cuối hóa đơn…); null nếu có thể là dòng hàng. */
export function skipReasonOf(text: string): ReceiptSkipReason | null {
  const words = foldText(text).replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  const rule = skipRules().find(([, pattern]) => pattern.test(words));
  if (rule) return rule[0];
  if (TIME.test(text) || DATE.test(text)) return "HEADER";
  if (/(^|\s)-\s?\d[\d.,]{2,}/.test(text)) return "DISCOUNT";
  return null;
}

const NET_AMOUNT = /(\d[\d.,]*)\s*(kg|g|gr|gram|ml|l|lít|lit)\b/iu;
const isNameOnly = (item: RawReceiptItem) => item.quantity === null && item.price === null && item.expiryDate === null;

/**
 * Phân tích các dòng chữ của một hóa đơn (hoặc nhãn sản phẩm). Hóa đơn: dòng chỉ có tên đứng trước dòng hàng đầu tiên là
 * đầu hóa đơn, đứng sau dòng hàng cuối là cuối hóa đơn. Nhãn (không dòng nào có giá): một sản phẩm, lấy khối lượng tịnh và HSD.
 */
export function parseReceiptLines(input: Array<OcrLine | string>): ParsedReceipt {
  const items: RawReceiptItem[] = [];
  const skipped: SkippedReceiptLine[] = [];
  let pending: RawReceiptItem | null = null;
  let pendingExpiry: string | null = null;
  let netAmount: { quantity: number; unit: FoodUnit } | null = null;

  const addItem = (item: RawReceiptItem) => {
    if (pendingExpiry && !item.expiryDate) {
      item.expiryDate = pendingExpiry;
      pendingExpiry = null;
    }
    items.push(item);
    pending = item.price === null ? item : null;
  };

  for (const line of input) {
    const { text: rawText, confidence } = typeof line === "string" ? { text: line, confidence: null } : line;
    const text = rawText.normalize("NFC").replace(/\s+/g, " ").trim();
    if (!/[\p{L}\p{N}]/u.test(text)) continue; // "-----", "====="
    const folded = foldText(text);

    if (EXPIRY_KEYWORD.test(folded)) {
      const expiry = parseReceiptDate(text);
      if (expiry) {
        const last = items.at(-1);
        if (last) last.expiryDate = expiry;
        else pendingExpiry = expiry;
      }
      skipped.push({ rawText: text, reason: "LABEL_INFO" });
      continue;
    }
    if (PRODUCTION_KEYWORD.test(folded)) {
      skipped.push({ rawText: text, reason: "LABEL_INFO" });
      continue;
    }
    if (NET_KEYWORD.test(folded)) {
      const net = NET_AMOUNT.exec(text);
      const unit = net ? UNIT_WORDS[foldText(net[2])] : undefined;
      if (net && unit) netAmount = { quantity: Math.min(...numberCandidates(net[1])), unit };
      skipped.push({ rawText: text, reason: "LABEL_INFO" });
      continue;
    }

    // Dòng chỉ có số ("0.512 x 129.000 66.048", "SL: 4 ĐG: 8.500 TT: 34.000") → phần số của dòng tên ngay trên.
    const numericOnly = !tokenize(text.replace(CONTINUATION_LABELS, " ")).some((token) => token.kind === "word");
    if (numericOnly) {
      const target = pending as RawReceiptItem | null; // gán trong addItem (closure), TS không theo dõi được
      if (target) {
        const merged = parseItemLine(`${target.rawText} ${text}`, minConfidence(target.confidence, confidence));
        if (merged) {
          merged.expiryDate = target.expiryDate;
          items[items.indexOf(target)] = merged;
          pending = merged.price === null ? merged : null;
          continue;
        }
      }
      skipped.push({ rawText: text, reason: "NOISE" });
      continue;
    }

    const reason = skipReasonOf(text);
    if (reason) {
      skipped.push({ rawText: text, reason });
      pending = null;
      continue;
    }
    const item = parseItemLine(text, confidence);
    if (item) addItem(item);
    else skipped.push({ rawText: text, reason: "NOISE" });
  }

  const priced = items.map((item, index) => (item.price !== null ? index : -1)).filter((index) => index >= 0);
  if (!priced.length) return labelResult(items, skipped, netAmount, pendingExpiry);
  const [first, last] = [priced[0], priced.at(-1)!];
  const kept = items.filter((item, index) => {
    if (!isNameOnly(item) || (index > first && index < last)) return true;
    skipped.push({ rawText: item.rawText, reason: index < first ? "HEADER" : "NOISE" });
    return false;
  });
  return { items: kept, skipped };
}

/** Nhãn sản phẩm: dòng tên đầu tiên là sản phẩm; các dòng chữ khác (thành phần, hướng dẫn…) bỏ với lý do LABEL_INFO. */
function labelResult(items: RawReceiptItem[], skipped: SkippedReceiptLine[], net: { quantity: number; unit: FoodUnit } | null, expiry: string | null) {
  const [product, ...others] = items;
  for (const other of others) skipped.push({ rawText: other.rawText, reason: "LABEL_INFO" });
  if (!product) return { items: [], skipped };
  if (product.quantity === null && net) Object.assign(product, net);
  // Dòng HSD có thể nằm sau dòng thành phần/hướng dẫn (đã gắn vào dòng đó): chuyển về sản phẩm.
  product.expiryDate ??= others.find((other) => other.expiryDate)?.expiryDate ?? expiry;
  return { items: [product], skipped };
}

function minConfidence(a: number | null, b: number | null) {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * Kết quả của mọi nhà cung cấp → cùng một dạng. Văn bản (Tesseract) qua bộ phân tích dòng; dòng hàng có cấu trúc (OpenAI)
 * vẫn qua bộ lọc bỏ dòng tổng tiền/VAT/túi/phí… để hai chế độ so sánh được với nhau.
 */
export function parseOcrOutput(output: OcrOutput): ParsedReceipt {
  if (output.kind === "text") return parseReceiptLines(output.lines);
  const parsed: ParsedReceipt = { items: [], skipped: [] };
  for (const item of output.items) {
    const reason = skipReasonOf(item.rawText || item.name);
    if (reason) parsed.skipped.push({ rawText: item.rawText || item.name, reason });
    else parsed.items.push(item);
  }
  return parsed;
}
