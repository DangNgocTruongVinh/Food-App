import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import Tesseract from "tesseract.js";
import type { OcrLine, OcrOutput, ReceiptOcrProvider } from "../receipt-types.js";

// Đọc hóa đơn bằng Tesseract (tesseract.js, WASM) ngay trên server, không cần mạng: dữ liệu tiếng Việt + tiếng Anh lấy từ gói
// npm @tesseract.js-data/vie, @tesseract.js-data/eng (bản LSTM "best_int") đóng gói sẵn trong image. Hai gói nằm ở hai thư mục
// khác nhau mà tesseract.js chỉ nhận một langPath, nên lần đầu dùng sẽ chép hai file vào một thư mục tạm.
// Một worker dùng chung, xử lý lần lượt; tối đa MAX_WAITING yêu cầu chờ; quá READ_TIMEOUT_MS thì hủy worker (tạo lại lần sau).

const require = createRequire(import.meta.url);
const LANGUAGES = ["vie", "eng"] as const;
const MAX_WAITING = 3;
const READ_TIMEOUT_MS = 90_000;

const languageFile = (code: string) => {
  try {
    return path.join(path.dirname(require.resolve(`@tesseract.js-data/${code}/package.json`)), "4.0.0_best_int", `${code}.traineddata.gz`);
  } catch {
    return null;
  }
};

async function prepareLanguageDir() {
  const dir = path.join(os.tmpdir(), "nouri-tessdata");
  await mkdir(dir, { recursive: true });
  for (const code of LANGUAGES) {
    const source = languageFile(code);
    if (!source) throw new Error(`Thiếu dữ liệu Tesseract cho "${code}".`);
    const target = path.join(dir, `${code}.traineddata.gz`);
    if (!existsSync(target)) await copyFile(source, target);
  }
  return dir;
}

/** Gom chữ theo dòng (kèm độ tin cậy) từ kết quả nhận dạng. */
function linesOf(page: Tesseract.Page): OcrLine[] {
  const lines = (page.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
  if (lines.length) return lines.map((line) => ({ text: line.text.trim(), confidence: Math.round(line.confidence) })).filter((line) => line.text);
  return page.text.split("\n").map((text) => ({ text: text.trim(), confidence: null })).filter((line) => line.text);
}

export class TesseractProvider implements ReceiptOcrProvider {
  readonly id = "tesseract" as const;
  private worker: Promise<Tesseract.Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private waiting = 0;
  private onProgress: ((progress: number) => void) | null = null;

  isAvailable() {
    return LANGUAGES.every((code) => languageFile(code) !== null);
  }

  canAccept() {
    return this.waiting < MAX_WAITING;
  }

  read(image: Buffer, onProgress?: (progress: number) => void): Promise<OcrOutput> {
    this.waiting += 1;
    const job = this.queue.then(() => this.recognize(image, onProgress)).finally(() => {
      this.waiting -= 1;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  private getWorker() {
    this.worker ??= prepareLanguageDir().then(async (langPath) => {
      const worker = await Tesseract.createWorker([...LANGUAGES], Tesseract.OEM.LSTM_ONLY, {
        langPath, cacheMethod: "none", gzip: true,
        logger: (message) => {
          if (message.status === "recognizing text") this.onProgress?.(message.progress);
        },
      });
      // Hóa đơn là một cột chữ; giữ khoảng trắng giữa các cột (tên … SL … giá).
      await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
      return worker;
    });
    this.worker.catch(() => {
      this.worker = null;
    });
    return this.worker;
  }

  private async recognize(image: Buffer, onProgress?: (progress: number) => void): Promise<OcrOutput> {
    const worker = await this.getWorker();
    this.onProgress = onProgress ?? null;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("TESSERACT_TIMEOUT")), READ_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([worker.recognize(image, {}, { text: true, blocks: true }), timeout]);
      return { kind: "text", lines: linesOf(result.data) };
    } catch (error) {
      // Worker treo hoặc lỗi: hủy để lần sau tạo lại.
      this.worker = null;
      void worker.terminate().catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(timer);
      this.onProgress = null;
    }
  }

  async close() {
    const worker = this.worker;
    this.worker = null;
    if (worker) await (await worker).terminate();
  }
}
