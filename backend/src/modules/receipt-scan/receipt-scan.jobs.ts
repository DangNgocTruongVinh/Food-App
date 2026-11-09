import type { ReceiptDraftLine } from "../../services/receipt/receipt-normalize.js";
import type { SkippedReceiptLine } from "../../services/receipt/receipt-types.js";

// Trạng thái các lần quét đang chạy và dòng nháp, CHỈ giữ trong bộ nhớ server (không lưu văn bản đọc được vào DB).
// Màn quét hỏi GET /:id để hiện tiến trình. Hết DRAFT_TTL_MS hoặc server khởi động lại thì mất (người dùng quét lại).

export type ReceiptScanPhase = "queued" | "reading" | "parsing" | "ready" | "failed";
export type ReceiptDraft = { items: ReceiptDraftLine[]; skipped: SkippedReceiptLine[] };
export type ReceiptJob = { userId: string; phase: ReceiptScanPhase; progress: number; draft: ReceiptDraft | null; error: string | null; expiresAt: number };

export const DRAFT_TTL_MS = 30 * 60_000;
const ACTIVE: ReceiptScanPhase[] = ["queued", "reading", "parsing"];
const jobs = new Map<string, ReceiptJob>();

function sweep(now: number) {
  for (const [id, job] of jobs) if (job.expiresAt <= now) jobs.delete(id);
}

export const receiptJobs = {
  create(scanId: string, userId: string, now = Date.now()) {
    sweep(now);
    jobs.set(scanId, { userId, phase: "queued", progress: 0, draft: null, error: null, expiresAt: now + DRAFT_TTL_MS });
  },
  /** Chỉ trả lần quét của đúng người dùng. */
  get(scanId: string, userId: string, now = Date.now()) {
    sweep(now);
    const job = jobs.get(scanId);
    return job && job.userId === userId ? job : null;
  },
  update(scanId: string, patch: Partial<Omit<ReceiptJob, "userId" | "expiresAt">>) {
    const job = jobs.get(scanId);
    if (job) Object.assign(job, patch);
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
