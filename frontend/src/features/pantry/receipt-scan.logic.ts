import type {
  FoodUnit, ReceiptCommitLine, ReceiptCommitResult, ReceiptDraftLine, ReceiptLineFlag, ReceiptLineTarget, ReceiptProviderId,
  ReceiptScanPhase, ReceiptSkipReason, ReceiptUndoResult, StorageLocation,
} from "../../types";
import { formatPantryQuantity } from "./pantry.logic";

// Quét hóa đơn (GĐ3c): logic thuần cho hộp quét, màn tiến trình và màn duyệt ở trang Kho.

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Thu nhỏ ở trình duyệt trước khi gửi (cạnh dài), giống giới hạn đọc ở server. */
export const RECEIPT_LONG_SIDE = 2000;

/** Kiểm tra file gửi đi (sau khi đã thu nhỏ). null: hợp lệ. */
export function receiptFileError(file: { size: number; type: string }) {
  if (!RECEIPT_IMAGE_TYPES.includes(file.type)) return "Chỉ nhận ảnh JPG, PNG hoặc WEBP.";
  if (file.size > MAX_RECEIPT_BYTES) return "Ảnh vượt quá 5 MB. Hãy chụp lại hoặc chọn ảnh nhỏ hơn.";
  return null;
}

/** Kích thước sau khi thu nhỏ (giữ tỉ lệ, không phóng to). */
export function scaledSize(width: number, height: number, longSide = RECEIPT_LONG_SIDE) {
  const ratio = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export type ScanStage = "uploading" | ReceiptScanPhase;
export type ScanStep = "upload" | "read" | "parse";
export const SCAN_STEPS: Array<{ step: ScanStep; label: string }> = [
  { step: "upload", label: "Tải ảnh lên" },
  { step: "read", label: "Đọc chữ trên ảnh" },
  { step: "parse", label: "Phân tích dòng hàng" },
];

export function scanStepOf(stage: ScanStage): ScanStep {
  if (stage === "uploading") return "upload";
  return stage === "queued" || stage === "reading" ? "read" : "parse";
}

export const percent = (fraction: number) => `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)} %`;

/** Câu mô tả bước đang chạy, kèm phần trăm khi có. */
export function scanStageText(stage: ScanStage, fraction: number | null) {
  if (stage === "uploading") return fraction === null ? "Đang tải ảnh lên" : `Đang tải ảnh lên ${percent(fraction)}`;
  if (stage === "queued") return "Đang chờ đọc ảnh";
  if (stage === "reading") return fraction === null ? "Đang đọc chữ trên ảnh" : `Đang đọc chữ trên ảnh ${percent(fraction)}`;
  return "Đang phân tích các dòng hàng";
}

export const PROVIDER_LABELS: Record<ReceiptProviderId, string> = {
  tesseract: "Chế độ dự phòng (Tesseract, đọc trên máy chủ)",
  openai: "OpenAI",
};

/** Dòng nhắc ở đầu màn duyệt: chế độ đọc đang dùng. */
export function providerNotice(provider: ReceiptProviderId) {
  return provider === "tesseract"
    ? "Đọc bằng chế độ dự phòng, vui lòng kiểm tra kỹ từng dòng trước khi lưu."
    : "Đọc bằng OpenAI. Vẫn nên kiểm tra lại từng dòng trước khi lưu.";
}

export const SKIP_REASON_LABELS: Record<ReceiptSkipReason, string> = {
  HEADER: "Đầu/cuối hóa đơn",
  TOTAL: "Tổng tiền",
  TAX: "Thuế VAT",
  DISCOUNT: "Giảm giá",
  PAYMENT: "Thanh toán",
  BAG: "Túi",
  FEE: "Phí",
  POINTS: "Điểm thành viên",
  LABEL_INFO: "Thông tin trên nhãn",
  NOISE: "Không rõ",
};

export const FLAG_LABELS: Record<ReceiptLineFlag, string> = {
  LOW_CONFIDENCE: "Chữ mờ, kiểm tra lại",
  QUANTITY_GUESSED: "Chưa đọc được số lượng",
  UNIT_GUESSED: "Chưa rõ đơn vị",
  NAME_UNMATCHED: "Tên chưa khớp thực phẩm quen thuộc",
  PRICE_MISMATCH: "Số lượng chưa khớp thành tiền",
};

export function warningText(warning: ReceiptDraftLine["warnings"][number]) {
  return warning.kind === "ALLERGY" ? `Có “${warning.term}”, bạn đã khai báo dị ứng` : `Có “${warning.term}”, bạn đã khai báo không thích`;
}

/** Một dòng trên màn duyệt: giá trị đang sửa và bản gốc từ dòng nháp (để biết hạn còn là ước tính, đích còn đúng không). */
export type EditableLine = {
  key: string;
  include: boolean;
  name: string;
  quantity: number;
  unit: FoodUnit;
  category: string;
  storageLocation: StorageLocation;
  expiryDate: string;
  rawText: string;
  target: ReceiptLineTarget;
  warnings: ReceiptDraftLine["warnings"];
  flags: ReceiptLineFlag[];
  draft: { name: string; unit: FoodUnit; expiryDate: string; expiryEstimated: boolean };
  restored: boolean;
};

export function toEditableLines(items: ReceiptDraftLine[]): EditableLine[] {
  return items.map((item) => ({
    key: item.key, include: true, name: item.name, quantity: item.quantity, unit: item.unit, category: item.category,
    storageLocation: item.storageLocation, expiryDate: item.expiryDate ?? "", rawText: item.rawText, target: item.target,
    warnings: item.warnings, flags: item.flags,
    draft: { name: item.name, unit: item.unit, expiryDate: item.expiryDate ?? "", expiryEstimated: item.expiryEstimated },
    restored: false,
  }));
}

/** Khôi phục một dòng bị bỏ: tên là chữ đọc được (bỏ phần số cuối dòng), 1 cái, nhóm "Khác", không hạn. */
export function restoreSkippedLine(rawText: string, index: number): EditableLine {
  const name = rawText.replace(/[\d\s.,:xX×*=đ-]+$/u, "").trim() || rawText.trim();
  return {
    key: `skipped-${index}`, include: true, name, quantity: 1, unit: "ITEM", category: "Khác", storageLocation: "REFRIGERATOR",
    expiryDate: "", rawText, target: { kind: "create" }, warnings: [], flags: [],
    draft: { name, unit: "ITEM", expiryDate: "", expiryEstimated: false }, restored: true,
  };
}

/** Hạn vẫn là ngày hệ thống ước tính (người dùng chưa sửa). */
export const isExpiryEstimated = (line: EditableLine) =>
  line.draft.expiryEstimated && line.expiryDate !== "" && line.expiryDate === line.draft.expiryDate;

const sameText = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi") === b.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

/** Chỗ dòng sẽ vào trong kho. Đã sửa tên/đơn vị thì server ghép lại khi lưu (cùng quy tắc "Đã mua"). */
export function targetText(line: EditableLine) {
  if (line.restored || !sameText(line.name, line.draft.name) || line.unit !== line.draft.unit) {
    return "Khi lưu: cộng vào thực phẩm cùng tên trong kho nếu có, không thì tạo mới.";
  }
  const { target } = line;
  if (target.kind === "merge") return `Cộng vào “${target.name}” đang có ${formatPantryQuantity(target.quantity, target.unit)}`;
  if (target.kind === "reuse") return `Dùng lại “${target.name}” (đã dùng hết)`;
  return "Tạo thực phẩm mới trong kho";
}

export type LineErrors = Partial<Record<"name" | "quantity" | "expiryDate", string>>;

export function lineErrors(line: EditableLine, expiryInvalid: boolean): LineErrors {
  const errors: LineErrors = {};
  const name = line.name.trim();
  if (!name) errors.name = "Nhập tên thực phẩm.";
  else if (name.length > 100) errors.name = "Tên tối đa 100 ký tự.";
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.quantity = "Nhập số lượng lớn hơn 0.";
  else if (line.quantity > 100_000) errors.quantity = "Số lượng quá lớn.";
  if (expiryInvalid) errors.expiryDate = "Nhập ngày theo dạng dd/mm/yyyy hoặc để trống.";
  return errors;
}

/** Lỗi của các dòng đang chọn; rỗng là lưu được. */
export function reviewErrors(lines: EditableLine[], invalidExpiry: ReadonlySet<string>) {
  return Object.fromEntries(lines.filter((line) => line.include)
    .map((line) => [line.key, lineErrors(line, invalidExpiry.has(line.key))] as const)
    .filter(([, errors]) => Object.keys(errors).length));
}

export const MAX_COMMIT_LINES = 60;

export function toCommitLines(lines: EditableLine[]): ReceiptCommitLine[] {
  return lines.filter((line) => line.include).map((line) => ({
    name: line.name.trim().replace(/\s+/g, " "), quantity: line.quantity, unit: line.unit, category: line.category,
    storageLocation: line.storageLocation, expiryDate: line.expiryDate || null, expiryEstimated: isExpiryEstimated(line),
  }));
}

export const EMPTY_DRAFT_MESSAGE = "Không tìm thấy dòng hàng nào trên ảnh. Hãy chụp lại rõ hơn, khôi phục dòng bên dưới hoặc nhập tay.";

export function commitMessage(result: Pick<ReceiptCommitResult, "added">) {
  return `Đã thêm ${result.added.length} thực phẩm từ hóa đơn vào kho.`;
}

export function undoMessage(result: Pick<ReceiptUndoResult, "restored" | "skipped">) {
  const base = `Đã hoàn tác hóa đơn: trừ lại ${result.restored.length} thực phẩm.`;
  return result.skipped.length ? `${base} ${result.skipped.length} dòng không trừ lại được vì đã dùng, đã sửa hoặc đã xóa.` : base;
}

/** Lời báo khi gửi ảnh lỗi; hết lượt trong ngày thì gợi ý nhập tay. */
export function uploadErrorMessage(status: number | undefined, serverMessage: string) {
  if (status === 429) return `${serverMessage} Bạn vẫn có thể nhập tay.`;
  return serverMessage;
}
