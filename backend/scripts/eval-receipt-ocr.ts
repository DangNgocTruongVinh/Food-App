import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedRecipes } from "../prisma/seed-data.js";
import { MockProvider } from "../src/services/receipt/providers/mock-provider.js";
import { TesseractProvider } from "../src/services/receipt/providers/tesseract-provider.js";
import { type ReceiptAnswer, scoreReceipt, summarizeScores } from "../src/services/receipt/receipt-eval.js";
import { prepareReceiptImage } from "../src/services/receipt/receipt-image.js";
import { normalizeReceiptItems } from "../src/services/receipt/receipt-normalize.js";
import { parseOcrOutput } from "../src/services/receipt/receipt-parser.js";
import type { OcrOutput, ReceiptOcrProvider } from "../src/services/receipt/receipt-types.js";

// Đo tỉ lệ đọc đúng của quét hóa đơn trên bộ ảnh thật (GĐ3c). Không cần DB: tên đã biết lấy từ seed-data (33 món), kho rỗng.
//   npm run eval:receipt -w backend                          (Tesseract trên rNN.jpg|png|webp)
//   npm run eval:receipt -w backend -- --parser-only         (chỉ bộ phân tích, đọc rNN.txt gõ lại → tách lỗi OCR khỏi lỗi phân tích)
//   npm run eval:receipt -w backend -- --provider mock | --dir <thư mục> | --no-write
// Kết quả ghi vào <thư mục>/ket-qua-<chế độ>.md. Đáp án: rNN.json theo _mau-dap-an.json (tệp bắt đầu bằng "_" bị bỏ qua).

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const parserOnly = args.includes("--parser-only");
const providerId = option("--provider") ?? "tesseract";
const dir = resolve(option("--dir") ?? join(dirname(fileURLToPath(import.meta.url)), "../../docs/test-evidence/receipts"));
const mode = parserOnly ? "parser" : providerId;

function createProvider(): ReceiptOcrProvider {
  if (providerId === "tesseract") return new TesseractProvider();
  if (providerId === "mock") return new MockProvider();
  throw new Error(`Chưa hỗ trợ --provider ${providerId} (OpenAI làm ở GĐ3c phần 2).`);
}

const knownNames = [...new Set(seedRecipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)))];
const imageOf = (id: string) => ["jpg", "jpeg", "png", "webp"].map((ext) => join(dir, `${id}.${ext}`)).find(existsSync);
const pct = (value: number) => `${(value * 100).toFixed(1)} %`;

async function main() {
  if (!existsSync(dir)) throw new Error(`Không có thư mục ${dir}`);
  const answers = readdirSync(dir).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  if (!answers.length) {
    console.log(`Chưa có đáp án nào trong ${dir} (xem README.md và _mau-dap-an.json).`);
    return;
  }
  const provider = parserOnly ? null : createProvider();
  const rows: string[] = [];
  const scores = [];
  for (const file of answers) {
    const answer = JSON.parse(readFileSync(join(dir, file), "utf8")) as ReceiptAnswer;
    const id = file.replace(/\.json$/, "");
    let output: OcrOutput;
    const startedAt = Date.now();
    if (provider) {
      const image = imageOf(id);
      if (!image) {
        console.log(`${id}: bỏ qua (không có ảnh)`);
        continue;
      }
      output = await provider.read(await prepareReceiptImage(readFileSync(image), "ocr"));
    } else {
      const textFile = join(dir, `${id}.txt`);
      if (!existsSync(textFile)) {
        console.log(`${id}: bỏ qua (không có ${id}.txt)`);
        continue;
      }
      output = { kind: "text", lines: readFileSync(textFile, "utf8").split(/\r?\n/).map((text) => ({ text, confidence: null })) };
    }
    const ms = Date.now() - startedAt;
    const parsed = parseOcrOutput(output);
    const items = normalizeReceiptItems(parsed.items, { pantry: [], knownNames, allergies: [], dislikedFoods: [], now: new Date() });
    const score = scoreReceipt(items, answer.items);
    scores.push(score);
    rows.push(`| ${id} | ${score.expected} | ${score.predicted} | ${score.matched} | ${score.nameExact} | ${score.unitOk} | ${score.quantityOk} | ${ms} |`);
  }
  if (provider instanceof TesseractProvider) await provider.close();
  const total = summarizeScores(scores);
  const report = [
    `# Kết quả quét hóa đơn — chế độ \`${mode}\``,
    "",
    `Chạy ngày ${new Date().toISOString().slice(0, 10)}, ${scores.length} hóa đơn. Lệnh: \`npm run eval:receipt -w backend -- ${args.join(" ")}\`.`,
    "",
    "| Hóa đơn | Dòng đáp án | Dòng đọc được | Ghép được | Tên đúng | Đơn vị đúng | Số lượng đúng | Thời gian (ms) |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `- Đúng dòng: precision ${pct(total.precision)}, recall ${pct(total.recall)}, F1 ${pct(total.f1)}`,
    `- Trên ${total.expected} dòng đáp án: tên đúng ${pct(total.nameRate)}, đơn vị đúng ${pct(total.unitRate)}, số lượng đúng ${pct(total.quantityRate)}`,
    "",
    "Ghép dòng theo độ giống tên (bỏ dấu) ≥ 0,5; tên đúng = trùng hẳn sau khi bỏ dấu; đơn vị đúng = cùng nhóm quy đổi; số lượng đúng = lệch ≤ 1 %.",
    "",
  ].join("\n");
  console.log(report);
  if (!args.includes("--no-write")) writeFileSync(join(dir, `ket-qua-${mode}.md`), report, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
