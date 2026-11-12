import type { ReceiptOcrProvider as ProviderEnum, ReceiptScanStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import {
  defaultReceiptProvider, receiptProvider, receiptProviderOptions, scanPlan, type ScanMode, type SelectableProvider,
} from "../../services/receipt/ocr-providers.js";
import { VisionReadError } from "../../services/receipt/providers/openai-vision-provider.js";
import { prepareReceiptImage } from "../../services/receipt/receipt-image.js";
import { normalizeReceiptItems, type NormalizeContext } from "../../services/receipt/receipt-normalize.js";
import { parseOcrOutput } from "../../services/receipt/receipt-parser.js";
import type { OcrOutput, ReceiptOcrProvider } from "../../services/receipt/receipt-types.js";
import { HttpError } from "../../utils/http-error.js";
import { vietnamToday } from "../../utils/vietnam-date.js";
import {
  addToPantry, REUSED_DEPLETED_NOTE, reversePantryIntake, syncPantryNotificationsQuietly, type IntakeLink,
} from "../pantry/pantry-intake.js";
import { receiptJobs } from "./receipt-scan.jobs.js";
import type { ReceiptLineInput } from "./receipt-scan.schema.js";

// Quét hóa đơn (GĐ3c): nhận ảnh → đọc nền (OCR) → phân tích → chuẩn hóa thành dòng nháp; người dùng duyệt rồi lưu một lô vào
// kho (nguồn RECEIPT_SCAN), hoàn tác được cả lô. Mọi thao tác lọc theo userId từ JWT; lần quét của người khác → 404.

export const RECEIPT_CREATED_NOTE = "Tạo mới từ hóa đơn";
const PROVIDER_ENUM: Record<SelectableProvider, ProviderEnum> = { tesseract: "TESSERACT", openai: "OPENAI" };
const KNOWN_NAMES_TTL_MS = 10 * 60_000;
const notFound = () => new HttpError(404, "Không tìm thấy lần quét.");

const receiptLink = (receiptScanId: string): IntakeLink => ({
  source: "RECEIPT_SCAN", receiptScanId, createdNote: RECEIPT_CREATED_NOTE, reusedNote: REUSED_DEPLETED_NOTE,
});

/** 00:00 hôm nay theo giờ Việt Nam (UTC+7), dạng thời điểm UTC. */
const vietnamDayStart = (now: Date) => new Date(vietnamToday(now).getTime() - 7 * 3_600_000);

function countScansToday(userId: string, now: Date) {
  return prisma.receiptScan.count({ where: { userId, createdAt: { gte: vietnamDayStart(now) } } });
}

export async function getReceiptScanStatus(userId: string, now = new Date()) {
  const used = await countScansToday(userId, now);
  const limit = env.RECEIPT_SCAN_DAILY_LIMIT;
  return {
    providers: receiptProviderOptions(), defaultProvider: defaultReceiptProvider(),
    dailyLimit: limit, usedToday: used, remainingToday: Math.max(0, limit - used),
  };
}

let knownNamesCache: { names: string[]; expiresAt: number } | null = null;

/** Tên nguyên liệu của bộ món (để ghép tên không dấu trên hóa đơn với tên có dấu); nhớ 10 phút. */
async function knownIngredientNames(now = Date.now()) {
  if (knownNamesCache && knownNamesCache.expiresAt > now) return knownNamesCache.names;
  const rows = await prisma.recipeIngredient.findMany({ distinct: ["name"], select: { name: true } });
  knownNamesCache = { names: rows.map((row) => row.name), expiresAt: now + KNOWN_NAMES_TTL_MS };
  return knownNamesCache.names;
}

async function loadNormalizeContext(userId: string): Promise<NormalizeContext> {
  const [pantry, profile, knownNames] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, select: { id: true, name: true, quantity: true, unit: true, expiryDate: true } }),
    prisma.nutritionProfile.findUnique({ where: { userId }, select: { allergies: true, dislikedFoods: true } }),
    knownIngredientNames(),
  ]);
  return { pantry, knownNames, allergies: profile?.allergies ?? [], dislikedFoods: profile?.dislikedFoods ?? [], now: new Date() };
}

/**
 * POST /api/pantry/receipt-scans: kiểm chế độ đọc, giới hạn lượt/ngày, hàng đợi; xử lý ảnh (xóa EXIF, thu nhỏ); tạo lần quét
 * rồi đọc nền. Trả ngay { id, phase: "queued" }; tiến trình xem ở GET /:id. Không ghi kho.
 */
export async function startReceiptScan(userId: string, image: Buffer, mode: ScanMode = "auto", now = new Date()) {
  const [providerId, backupId] = scanPlan(mode, receiptProviderOptions());
  const provider = providerId ? receiptProvider(providerId) : null;
  if (!providerId || !provider) {
    const reason = receiptProviderOptions().find((option) => option.id === providerId)?.reason;
    throw new HttpError(503, reason ?? "Chưa có chế độ đọc hóa đơn nào dùng được.");
  }
  const backup = backupId ? receiptProvider(backupId) : null;
  if (receiptJobs.hasActive(userId)) throw new HttpError(409, "Đang có một lần quét chưa xong, vui lòng chờ.");
  const limit = env.RECEIPT_SCAN_DAILY_LIMIT;
  if (await countScansToday(userId, now) >= limit) {
    throw new HttpError(429, `Bạn đã quét ${limit} lần hôm nay. Vui lòng thử lại vào ngày mai.`);
  }
  if (!provider.canAccept()) throw new HttpError(503, "Máy chủ đang bận đọc hóa đơn khác, vui lòng thử lại sau ít phút.");
  const prepared = await prepareReceiptImage(image, providerId === "openai" ? "vision" : "ocr");
  const scan = await prisma.receiptScan.create({ data: { userId, provider: PROVIDER_ENUM[providerId] }, select: { id: true } });
  receiptJobs.create(scan.id, userId, providerId);
  // Ảnh gốc chỉ giữ trong bộ nhớ tới khi đọc xong, để chế độ "Tự động" đọc lại bằng Tesseract khi OpenAI lỗi.
  const finished = runScan(scan.id, userId, provider, prepared, backup ? { provider: backup, original: image } : null);
  return { scan: { id: scan.id, provider: providerId, phase: "queued" as const }, finished };
}

type Backup = { provider: ReceiptOcrProvider; original: Buffer };
type Usage = { inputTokens: number; outputTokens: number } | null;

/** Mã lỗi lưu DB + câu báo cho người dùng. */
export function failureOf(error: unknown) {
  if (error instanceof VisionReadError) {
    const message = error.code === "OPENAI_TIMEOUT" ? "Đọc bằng AI quá thời gian." : "Đọc bằng AI không thành công.";
    return { code: error.code, message: `${message} Hãy thử lại hoặc chọn "Chế độ dự phòng".` };
  }
  if (error instanceof Error && error.message === "TESSERACT_TIMEOUT") {
    return { code: "TIMEOUT", message: "Đọc ảnh quá lâu. Hãy chụp gần hơn, đủ sáng rồi thử lại." };
  }
  return { code: "READ_FAILED", message: "Không đọc được ảnh này. Hãy chụp lại rõ hơn." };
}

async function runScan(scanId: string, userId: string, provider: ReceiptOcrProvider, image: Buffer, backup: Backup | null) {
  const startedAt = Date.now();
  const onProgress = (progress: number) => receiptJobs.update(scanId, { phase: "reading", progress });
  // Token OpenAI ghi cả khi kết quả hỏng (vẫn mất phí); Tesseract không có.
  let usage: Usage = null;
  let fallbackCode: string | null = null;
  try {
    let output: OcrOutput;
    try {
      output = await provider.read(image, onProgress);
    } catch (error) {
      if (error instanceof VisionReadError) usage = error.usage;
      if (!backup || receiptJobs.get(scanId, userId)?.cancelled) throw error;
      fallbackCode = failureOf(error).code;
      console.warn("Quét hóa đơn: OpenAI lỗi, chuyển Tesseract:", fallbackCode);
      receiptJobs.update(scanId, { phase: "reading", progress: 0, provider: "tesseract", fallbackCode });
      output = await backup.provider.read(await prepareReceiptImage(backup.original, "ocr"), onProgress);
    }
    if (output.kind === "items" && output.usage) usage = output.usage;
    receiptJobs.update(scanId, { phase: "parsing", progress: 1 });
    if (receiptJobs.get(scanId, userId)?.cancelled) return;
    const parsed = parseOcrOutput(output);
    const items = normalizeReceiptItems(parsed.items, await loadNormalizeContext(userId));
    await prisma.receiptScan.updateMany({
      where: { id: scanId, status: "PROCESSING" },
      data: {
        status: "READY", lineCount: items.length, durationMs: Date.now() - startedAt, ...usage, fallbackCode,
        ...(fallbackCode ? { provider: "TESSERACT" as const } : {}),
      },
    });
    receiptJobs.update(scanId, { phase: "ready", draft: { items, skipped: parsed.skipped } });
  } catch (error) {
    const failure = failureOf(error);
    console.error("Quét hóa đơn lỗi:", error instanceof Error ? error.message : error);
    receiptJobs.update(scanId, { phase: "failed", error: failure.message });
    await prisma.receiptScan.updateMany({
      where: { id: scanId, status: "PROCESSING" },
      data: { status: "FAILED", errorCode: failure.code, durationMs: Date.now() - startedAt, ...usage, fallbackCode },
    }).catch(() => undefined);
  }
}

/**
 * POST /:id/cancel: hủy lần quét đang đọc (nút "Hủy" ở màn tiến trình). Lần quét thành FAILED (CANCELLED), vẫn tính lượt;
 * OCR đang chạy dở vẫn chạy hết ở nền nhưng kết quả bị bỏ. Đã đọc xong hoặc đã lưu thì không hủy được (409).
 */
export async function cancelReceiptScan(userId: string, id: string) {
  const scan = await prisma.receiptScan.findFirst({ where: { id, userId }, select: { status: true } });
  if (!scan) throw notFound();
  if (scan.status !== "PROCESSING") throw new HttpError(409, "Lần quét này đã đọc xong, không hủy được.");
  receiptJobs.cancel(id, userId); // false khi server đã khởi động lại (không còn trong bộ nhớ): vẫn đánh FAILED
  await prisma.receiptScan.updateMany({ where: { id, userId, status: "PROCESSING" }, data: { status: "FAILED", errorCode: "CANCELLED" } });
  return { id, status: "FAILED" as const };
}

const DONE_PHASE: Partial<Record<ReceiptScanStatus, "committed" | "reversed">> = { COMMITTED: "committed", REVERSED: "reversed" };

/** GET /api/pantry/receipt-scans/:id: tiến trình (queued/reading/parsing), dòng nháp khi xong, hoặc trạng thái đã lưu/hoàn tác. */
export async function getReceiptScan(userId: string, id: string) {
  const scan = await prisma.receiptScan.findFirst({
    where: { id, userId }, select: { id: true, provider: true, status: true, lineCount: true, createdAt: true, committedAt: true, reversedAt: true },
  });
  if (!scan) throw notFound();
  const base = { ...scan, provider: scan.provider.toLowerCase(), fallbackCode: null as string | null };
  const done = DONE_PHASE[scan.status];
  if (done) return { ...base, phase: done, progress: null, draft: null, error: null };
  const job = receiptJobs.get(id, userId);
  if (job) {
    return { ...base, provider: job.provider, fallbackCode: job.fallbackCode, phase: job.phase, progress: job.progress, draft: job.draft, error: job.error };
  }
  if (scan.status === "PROCESSING") {
    // Server khởi động lại giữa chừng: lần quét không còn chạy nữa.
    await prisma.receiptScan.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "FAILED", errorCode: "INTERRUPTED" } });
    return { ...base, status: "FAILED" as const, phase: "failed" as const, progress: null, draft: null, error: "Lần quét bị gián đoạn, vui lòng quét lại." };
  }
  const error = scan.status === "READY" ? "Bản nháp đã hết hạn, vui lòng quét lại." : "Không đọc được ảnh này. Hãy chụp lại rõ hơn.";
  return { ...base, phase: scan.status === "READY" ? "expired" as const : "failed" as const, progress: null, draft: null, error };
}

async function stateError(tx: { receiptScan: typeof prisma.receiptScan }, userId: string, id: string, messages: Partial<Record<ReceiptScanStatus, string>>) {
  const scan = await tx.receiptScan.findFirst({ where: { id, userId }, select: { status: true } });
  if (!scan) return notFound();
  return new HttpError(409, messages[scan.status] ?? "Lần quét này không còn lưu được.");
}

const toIntake = (line: ReceiptLineInput) => ({
  ...line,
  expiryDate: line.expiryDate ? new Date(`${line.expiryDate}T00:00:00.000Z`) : null,
  expiryEstimated: line.expiryDate ? line.expiryEstimated : false,
});

/** POST /:id/commit: lưu các dòng đã duyệt vào kho trong một transaction; mỗi lần quét chỉ lưu được một lần. */
export async function commitReceiptScan(userId: string, id: string, lines: ReceiptLineInput[], now = new Date()) {
  const added = await prisma.$transaction(async (tx) => {
    const claimed = await tx.receiptScan.updateMany({
      where: { id, userId, status: "READY" }, data: { status: "COMMITTED", committedAt: now, lineCount: lines.length },
    });
    if (!claimed.count) {
      throw await stateError(tx, userId, id, { COMMITTED: "Hóa đơn này đã được lưu vào kho.", PROCESSING: "Hóa đơn chưa đọc xong." });
    }
    const results = [];
    for (const line of lines) results.push(await addToPantry(tx, userId, toIntake(line), receiptLink(id), now));
    return results;
  });
  receiptJobs.delete(id);
  await syncPantryNotificationsQuietly(userId);
  return { id, status: "COMMITTED" as const, added };
}

/** POST /:id/undo: hoàn tác cả lô đã lưu (như bỏ "Đã mua"): xóa thực phẩm do lô tạo nếu chưa ai đụng tới, còn lại thì trừ lại. */
export async function undoReceiptScan(userId: string, id: string, now = new Date()) {
  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.receiptScan.updateMany({ where: { id, userId, status: "COMMITTED" }, data: { status: "REVERSED", reversedAt: now } });
    if (!claimed.count) {
      throw await stateError(tx, userId, id, {
        REVERSED: "Lần quét này đã được hoàn tác.", READY: "Hóa đơn chưa được lưu vào kho.", PROCESSING: "Hóa đơn chưa đọc xong.",
      });
    }
    const originals = await tx.pantryTransaction.findMany({
      where: { userId, receiptScanId: id, source: "RECEIPT_SCAN", reversalOfId: null, reversedAt: null }, orderBy: { createdAt: "asc" },
    });
    return reversePantryIntake(tx, userId, originals, receiptLink(id), now);
  });
  if (outcome.restored.length) await syncPantryNotificationsQuietly(userId);
  return { id, status: "REVERSED" as const, ...outcome };
}
