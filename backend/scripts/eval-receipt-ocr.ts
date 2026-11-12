import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { seedRecipes } from "../prisma/seed-data.js";
import { MockProvider } from "../src/services/receipt/providers/mock-provider.js";
import { OpenAIVisionProvider } from "../src/services/receipt/providers/openai-vision-provider.js";
import { TesseractProvider } from "../src/services/receipt/providers/tesseract-provider.js";
import {
  DEFAULT_TOKEN_PRICES, type ReceiptAnswer, scanCost, scoreReceipt, summarizeScores, type TokenPrices,
} from "../src/services/receipt/receipt-eval.js";
import { prepareReceiptImage } from "../src/services/receipt/receipt-image.js";
import { normalizeReceiptItems } from "../src/services/receipt/receipt-normalize.js";
import { parseOcrOutput } from "../src/services/receipt/receipt-parser.js";
import type { OcrOutput, ReceiptOcrProvider } from "../src/services/receipt/receipt-types.js";

// Đo tỉ lệ đọc đúng của quét hóa đơn trên bộ ảnh thật (GĐ3c). Không cần DB: tên đã biết lấy từ seed-data (33 món), kho rỗng.
//   npm run eval:receipt -w backend                          (Tesseract, và OpenAI nếu có OPENAI_API_KEY, trên rNN.jpg|png|webp)
//   npm run eval:receipt -w backend -- --provider openai     (một chế độ; nhiều chế độ: --provider tesseract,openai)
//   npm run eval:receipt -w backend -- --parser-only         (chỉ bộ phân tích, đọc rNN.txt gõ lại → tách lỗi OCR khỏi lỗi phân tích)
//   --dir <thư mục> | --no-write | --usd-in 0.25 --usd-out 2 (USD/1 triệu token) | --vnd 26000 (tỉ giá)
// Kết quả ghi vào <thư mục>/ket-qua.md (--parser-only: ket-qua-parser.md). Đáp án: rNN.json theo _mau-dap-an.json
// (tệp bắt đầu bằng "_" bị bỏ qua). Key OpenAI đọc từ .env ở thư mục gốc repo hoặc biến môi trường; không in ra.

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: join(root, ".env") });
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const parserOnly = args.includes("--parser-only");
const apiKey = process.env.OPENAI_API_KEY?.trim();
const modes = parserOnly ? ["parser"] : (option("--provider")?.split(",") ?? ["tesseract", ...(apiKey ? ["openai"] : [])]);
const dir = resolve(option("--dir") ?? join(root, "docs/test-evidence/receipts"));
const visionModel = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5-mini";
const prices: TokenPrices = {
  inputPerMillion: Number(option("--usd-in") ?? DEFAULT_TOKEN_PRICES.inputPerMillion),
  outputPerMillion: Number(option("--usd-out") ?? DEFAULT_TOKEN_PRICES.outputPerMillion),
  vndPerUsd: Number(option("--vnd") ?? DEFAULT_TOKEN_PRICES.vndPerUsd),
};

function createProvider(mode: string): ReceiptOcrProvider | null {
  if (mode === "parser") return null;
  if (mode === "tesseract") return new TesseractProvider();
  if (mode === "mock") return new MockProvider();
  if (mode === "openai") {
    if (!apiKey) throw new Error("Chế độ openai cần OPENAI_API_KEY (.env ở thư mục gốc).");
    return new OpenAIVisionProvider(new OpenAI({ apiKey }), visionModel);
  }
  throw new Error(`Không hỗ trợ --provider ${mode} (tesseract | openai | mock).`);
}

const knownNames = [...new Set(seedRecipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)))];
const imageOf = (id: string) => ["jpg", "jpeg", "png", "webp"].map((ext) => join(dir, `${id}.${ext}`)).find(existsSync);
const pct = (value: number) => `${(value * 100).toFixed(1)} %`;
const usd = (value: number) => `${value.toFixed(5)} USD`;
const vnd = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;

async function readOne(provider: ReceiptOcrProvider | null, id: string): Promise<OcrOutput | string> {
  if (!provider) {
    const textFile = join(dir, `${id}.txt`);
    if (!existsSync(textFile)) return `không có ${id}.txt`;
    return { kind: "text", lines: readFileSync(textFile, "utf8").split(/\r?\n/).map((text) => ({ text, confidence: null })) };
  }
  const image = imageOf(id);
  if (!image) return "không có ảnh";
  try {
    return await provider.read(await prepareReceiptImage(readFileSync(image), provider.id === "openai" ? "vision" : "ocr"));
  } catch (error) {
    return `lỗi đọc (${error instanceof Error ? error.message : String(error)})`;
  }
}

async function evaluate(mode: string, answers: string[]) {
  const provider = createProvider(mode);
  const rows: string[] = [];
  const scores = [];
  const times: number[] = [];
  const tokens = { inputTokens: 0, outputTokens: 0, scans: 0 };
  for (const file of answers) {
    const answer = JSON.parse(readFileSync(join(dir, file), "utf8")) as ReceiptAnswer;
    const id = file.replace(/\.json$/, "");
    const startedAt = Date.now();
    const output = await readOne(provider, id);
    const ms = Date.now() - startedAt;
    if (typeof output === "string") {
      console.log(`[${mode}] ${id}: bỏ qua (${output})`);
      rows.push(`| ${id} | ${answer.items.length} | — | — | — | — | — | ${ms} | ${output} |`);
      continue;
    }
    times.push(ms);
    let cost = "";
    if (output.kind === "items" && output.usage) {
      tokens.inputTokens += output.usage.inputTokens;
      tokens.outputTokens += output.usage.outputTokens;
      tokens.scans += 1;
      cost = `${output.usage.inputTokens}/${output.usage.outputTokens} token, ${vnd(scanCost(output.usage, prices).vnd)}`;
    }
    const parsed = parseOcrOutput(output);
    const items = normalizeReceiptItems(parsed.items, { pantry: [], knownNames, allergies: [], dislikedFoods: [], now: new Date() });
    const score = scoreReceipt(items, answer.items);
    scores.push(score);
    rows.push(`| ${id} | ${score.expected} | ${score.predicted} | ${score.matched} | ${score.nameExact} | ${score.unitOk} | ${score.quantityOk} | ${ms} | ${cost} |`);
  }
  if (provider instanceof TesseractProvider) await provider.close();
  const total = summarizeScores(scores);
  const averageMs = times.length ? Math.round(times.reduce((sum, ms) => sum + ms, 0) / times.length) : 0;
  const lines = [
    `## Chế độ \`${mode}\`${mode === "openai" ? ` (model \`${visionModel}\`)` : ""}`,
    "",
    `${scores.length} hóa đơn đọc được.`,
    "",
    "| Hóa đơn | Dòng đáp án | Dòng đọc được | Ghép được | Tên đúng | Đơn vị đúng | Số lượng đúng | Thời gian (ms) | Token vào/ra, chi phí |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `- Đúng dòng: precision ${pct(total.precision)}, recall ${pct(total.recall)}, F1 ${pct(total.f1)}`,
    `- Trên ${total.expected} dòng đáp án: tên đúng ${pct(total.nameRate)}, đơn vị đúng ${pct(total.unitRate)}, số lượng đúng ${pct(total.quantityRate)}`,
    `- Thời gian trung bình mỗi lần: ${averageMs} ms`,
  ];
  if (tokens.scans) {
    const average = { inputTokens: tokens.inputTokens / tokens.scans, outputTokens: tokens.outputTokens / tokens.scans };
    const cost = scanCost(average, prices);
    lines.push(
      `- Token trung bình mỗi lần: vào ${Math.round(average.inputTokens)}, ra ${Math.round(average.outputTokens)}`,
      `- Chi phí trung bình mỗi lần: ${usd(cost.usd)} ≈ ${vnd(cost.vnd)}`,
    );
  } else if (mode === "tesseract") {
    lines.push("- Chi phí: 0 (đọc trên máy chủ, chỉ tốn CPU)");
  }
  return [...lines, ""].join("\n");
}

async function main() {
  if (!existsSync(dir)) throw new Error(`Không có thư mục ${dir}`);
  const answers = readdirSync(dir).filter((file) => file.endsWith(".json") && !file.startsWith("_")).sort();
  if (!answers.length) {
    console.log(`Chưa có đáp án nào trong ${dir} (xem README.md và _mau-dap-an.json).`);
    return;
  }
  console.log(`Model đọc ảnh: ${visionModel}; giá ${prices.inputPerMillion}/${prices.outputPerMillion} USD mỗi triệu token vào/ra.`);
  const sections = [];
  for (const mode of modes) sections.push(await evaluate(mode, answers));
  const report = [
    "# Kết quả quét hóa đơn",
    "",
    `Chạy ngày ${new Date().toISOString().slice(0, 10)}, ${answers.length} đáp án. Lệnh: \`npm run eval:receipt -w backend${args.length ? ` -- ${args.join(" ")}` : ""}\`.`,
    `Model đọc ảnh: \`${visionModel}\` — giá tính chi phí: ${prices.inputPerMillion} USD/1 triệu token vào, `
      + `${prices.outputPerMillion} USD/1 triệu token ra, 1 USD = ${prices.vndPerUsd} đ (đối chiếu bảng giá của đúng model này).`,
    "",
    ...sections,
    "Ghép dòng theo độ giống tên (bỏ dấu) ≥ 0,5; tên đúng = trùng hẳn sau khi bỏ dấu; đơn vị đúng = cùng nhóm quy đổi; số lượng đúng = lệch ≤ 1 %.",
    "",
  ].join("\n");
  console.log(report);
  if (!args.includes("--no-write")) writeFileSync(join(dir, parserOnly ? "ket-qua-parser.md" : "ket-qua.md"), report, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
