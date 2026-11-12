import type { ReceiptDraftLine } from "../../services/receipt/receipt-normalize.js";
import type { SkippedReceiptLine } from "../../services/receipt/receipt-types.js";

// Trạng thái các lần quét đang chạy và dòng nháp, CHỈ giữ trong bộ nhớ server (không lưu văn bản đọc được vào DB).
// Màn quét hỏi GET /:id để hiện tiến trình. Hết DRAFT_TTL_MS hoặc server khởi động lại thì mất (người dùng quét lại).

export type ReceiptScanPhase = "queued" | "reading" | "parsing" | "ready" | "failed";
export type ReceiptDraft = { items: ReceiptDraftLine[]; skipped: SkippedReceiptLine[] };
export type ReceiptJob = {
  userId: string;
  /** Nhà cung cấp đang/đã đọc; đổi sang "tesseract" khi chế độ "Tự động" chuyển dự phòng (fallbackCode = lý do). */
  provider: "tesseract" | "openai"; fallbackCode: string | null; phase: ReceiptScanPhase; progress: number; draft: ReceiptDraft | null; error: string | null; expiresAt: number;
  /** Người dùng bấm "Hủy": OCR vẫn chạy xong ở nền nhưng kết quả bị bỏ, không còn chặn lần quét mới. */
  cancelled: boolean;
};

export const DRAFT_TTL_MS = 30 * 60_000;
const ACTIVE: ReceiptScanPhase[] = ["queued", "reading", "parsing"];
const jobs = new Map<string, ReceiptJob>();

function sweep(now: number) {
  for (const [id, job] of jobs) if (job.expiresAt <= now) jobs.delete(id);
}

export const receiptJobs = {
  create(scanId: string, userId: string, provider: ReceiptJob["provider"] = "tesseract", now = Date.now()) {
    sweep(now);
    jobs.set(scanId, { userId, provider, fallbackCode: null, phase: "queued", progress: 0, draft: null, error: null, expiresAt: now + DRAFT_TTL_MS, cancelled: false });
  },
  /** Chỉ trả lần quét của đúng người dùng. */
  get(scanId: string, userId: string, now = Date.now()) {
    sweep(now);
    const job = jobs.get(scanId);
    return job && job.userId === userId ? job : null;
  },
  /** Cập nhật tiến trình; lần quét đã hủy thì bỏ qua. */
  update(scanId: string, patch: Partial<Omit<ReceiptJob, "userId" | "expiresAt" | "cancelled">>) {
    const job = jobs.get(scanId);
    if (job && !job.cancelled) Object.assign(job, patch);
  },
  /** Hủy lần quét đang chạy của đúng người dùng; true nếu đã hủy. */
  cancel(scanId: string, userId: string) {
    const job = jobs.get(scanId);
    if (!job || job.userId !== userId || !ACTIVE.includes(job.phase)) return false;
    Object.assign(job, { phase: "failed", error: "Đã hủy lần quét.", cancelled: true });
    return true;
  },
  hasActive(userId: string, now = Date.now()) {
    sweep(now);
    return [...jobs.values()].some((job) => job.userId === userId && ACTIVE.includes(job.phase));
  },
  delete(scanId: string) {
    jobs.delete(scanId);
  },
  clear() {
    jobs.clear();
  },
};
