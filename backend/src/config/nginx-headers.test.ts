import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Header bảo mật của nginx (frontend): đủ ở mọi location phục vụ trang, không có CSP, không đặt lại cho /api/ (helmet lo).
const conf = readFileSync(new URL("../../../frontend/nginx.conf", import.meta.url), "utf8");
const block = (start: string) => {
  const from = conf.indexOf(start);
  return conf.slice(from, conf.indexOf("}", from));
};

describe("frontend/nginx.conf", () => {
  it.each(["location = /index.html", "location / {"])("%s có X-Frame-Options, X-Content-Type-Options, Referrer-Policy", (start) => {
    const body = block(start);
    expect(body).toContain('add_header X-Frame-Options "DENY" always;');
    expect(body).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(body).toContain('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
  });

  it("không có CSP, không thêm header bảo mật cho /api/", () => {
    expect(conf).not.toMatch(/Content-Security-Policy/i);
    expect(block("location /api/")).not.toMatch(/add_header/);
  });
});
