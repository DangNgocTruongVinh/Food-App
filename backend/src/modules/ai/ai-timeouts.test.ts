import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({ env: { OPENAI_MODEL: "gpt-5-mini" } }));
const { CHAT_TIMEOUT_MS, MEAL_PLAN_TIMEOUT_MS } = await import("./openai.service.js");
const { REVIEW_TIMEOUT_MS } = await import("../community/community-ai-review.js");
const { VISION_TIMEOUT_MS } = await import("../../services/receipt/providers/openai-vision-provider.js");

// nginx (frontend) phải chờ backend lâu hơn mọi lời gọi AI, nếu không người dùng nhận 504 dù backend vẫn xử lý xong
// (lỗi đã gặp: tạo thực đơn bằng OpenAI ~83 giây, nginx cắt ở 60 giây mặc định).
function nginxReadTimeoutMs() {
  const conf = readFileSync(fileURLToPath(new URL("../../../../frontend/nginx.conf", import.meta.url)), "utf8");
  const block = conf.slice(conf.indexOf("location /api/"));
  const match = /proxy_read_timeout\s+(\d+)(ms|s|m)?\s*;/.exec(block.slice(0, block.indexOf("}")));
  if (!match) return 60_000; // nginx mặc định 60 giây khi không khai báo
  const unit = match[2] ?? "s";
  return Number(match[1]) * (unit === "ms" ? 1 : unit === "m" ? 60_000 : 1000);
}

describe("Thời gian chờ nginx > thời gian chờ AI", () => {
  it.each([
    ["tạo thực đơn bằng AI", MEAL_PLAN_TIMEOUT_MS],
    ["trợ lý AI", CHAT_TIMEOUT_MS],
    ["đọc hóa đơn bằng AI", VISION_TIMEOUT_MS],
    ["kiểm duyệt bài cộng đồng", REVIEW_TIMEOUT_MS],
  ])("proxy_read_timeout của /api/ dài hơn %s (%i ms), dư ít nhất 30 giây", (_name, timeout) => {
    expect(nginxReadTimeoutMs()).toBeGreaterThanOrEqual(timeout + 30_000);
  });
});
