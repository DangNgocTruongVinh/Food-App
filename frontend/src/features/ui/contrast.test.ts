import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio, hexToRgb, readColorTokens } from "./contrast.logic";

const tokensCss = readFileSync(new URL("../../styles/ui/tokens.css", import.meta.url), "utf8");
const themes = {
  light: readColorTokens(tokensCss, '[data-theme="light"]'),
  dark: readColorTokens(tokensCss, '[data-theme="dark"]'),
};

describe("contrast helpers", () => {
  it("parses hex colors (3 and 6 digits) and rejects anything else", () => {
    expect(hexToRgb("#15483C")).toEqual([21, 72, 60]);
    expect(hexToRgb("fff")).toEqual([255, 255, 255]);
    expect(() => hexToRgb("rgb(0,0,0)")).toThrow();
  });

  it("computes WCAG ratios (black/white = 21, same color = 1, order does not matter)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#ffffff", "#15483c")).toBeCloseTo(contrastRatio("#15483c", "#ffffff"), 10);
  });
});

describe("design tokens (DESIGN.md mục 4)", () => {
  it("defines the same color tokens in both themes, matching the DESIGN.md table", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
    expect(themes.light).toMatchObject({ bg: "#fbfaf6", surface: "#ffffff", ink: "#17302a", action: "#15483c", accent: "#2f725d", warn: "#a43c18" });
    expect(themes.dark).toMatchObject({ bg: "#111814", surface: "#18211c", ink: "#f2efe7", action: "#2f725d", accent: "#9ccb8f", warn: "#f0a070" });
  });

  it.each(["light", "dark"] as const)("every text/background pair reaches its minimum contrast in %s mode", (theme) => {
    const failures = CONTRAST_PAIRS
      .map((pair) => ({ ...pair, ratio: contrastRatio(themes[theme][pair.fg], themes[theme][pair.bg]) }))
      .filter((pair) => pair.ratio < pair.min)
      .map((pair) => `${pair.fg} / ${pair.bg}: ${pair.ratio.toFixed(2)} < ${pair.min}`);
    expect(failures).toEqual([]);
  });
});

// Trang Đăng nhập / Đăng ký: bộ màu riêng --login-* (một khối :root trong tokens.css, giống nhau ở cả hai chế độ).
function readLoginTokens(css: string) {
  const at = css.indexOf("--login-forest:");
  if (at < 0) throw new Error("Không tìm thấy token --login-*");
  const block = css.slice(css.lastIndexOf("{", at), css.indexOf("}", at));
  return Object.fromEntries([...block.matchAll(/--login-([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map(([, name, value]) => [name, value]));
}

describe("login page colors (WCAG AA trên nền xanh đậm)", () => {
  const login = readLoginTokens(tokensCss);
  it.each([
    ["ivory", "forest", 4.5, "tiêu đề, nhãn, chữ thường trên nền xanh"],
    ["mist", "forest", 4.5, "mô tả, chữ phụ, điều khoản 12px"],
    ["gold", "forest", 4.5, "liên kết \"Tạo tài khoản\", viền focus"],
    ["forest", "gold", 4.5, "chữ nút \"Đăng nhập\""],
    ["forest", "gold-hover", 4.5, "chữ nút khi rê chuột"],
    ["forest", "gold-busy", 4.5, "chữ nút khi đang xử lý / nhấn"],
    ["forest", "ivory", 4.5, "chữ trong ô nhập, nút \"Hiện\""],
    ["error", "forest", 4.5, "lỗi dưới ô nhập"],
    ["error-ink", "error-bg", 4.5, "hộp lỗi từ máy chủ"],
    ["error-line", "forest", 3, "viền ô lỗi (thành phần phi văn bản)"],
    ["line", "forest", 3, "viền ô khi rê chuột"],
  ])("%s trên %s ≥ %s (%s)", (fg, bg, min) => {
    expect(contrastRatio(login[fg], login[bg])).toBeGreaterThanOrEqual(min);
  });
});
