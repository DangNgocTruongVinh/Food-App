import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Mặc định trong docker-compose.yml cho triển khai thật (audit M4, M5): đọc từ .env, giá trị trong file chỉ là mặc định an toàn.
const compose = readFileSync(new URL("../../../docker-compose.yml", import.meta.url), "utf8");

describe("docker-compose.yml", () => {
  it("FRONTEND_URL đặt được qua .env, mặc định http://localhost:8080 (audit M5)", () => {
    expect(compose).toContain("FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}");
  });

  it("tài khoản demo mặc định tắt, mật khẩu demo chỉ lấy từ .env (audit M4)", () => {
    expect(compose).toContain("SEED_DEMO: ${SEED_DEMO:-false}");
    expect(compose).toContain("DEMO_PASSWORD: ${DEMO_PASSWORD:-}");
  });
});
