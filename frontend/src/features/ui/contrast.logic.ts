// Tương phản màu theo WCAG 2.x (dùng để kiểm các cặp token chữ/nền ở cả hai chế độ, xem docs/design/contrast.md).

export type ThemeName = "light" | "dark";

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, "");
  const full = value.length === 3 ? [...value].map((char) => char + char).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Mã màu không hợp lệ: ${hex}`);
  return [0, 2, 4].map((start) => Number.parseInt(full.slice(start, start + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Đọc các token màu dạng hex của một khối selector trong tokens.css (vd. `[data-theme="dark"] {`). */
export function readColorTokens(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Không tìm thấy khối ${selector}`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map(([, name, value]) => [name, value]));
}

/** Cặp chữ/nền cần kiểm và ngưỡng tối thiểu (4.5 chữ thường; 3 cho chữ lớn ≥ 24px và thành phần phi văn bản). */
export const CONTRAST_PAIRS: { fg: string; bg: string; min: number; use: string }[] = [
  { fg: "ink", bg: "bg", min: 4.5, use: "Chữ chính trên nền trang" },
  { fg: "ink", bg: "surface", min: 4.5, use: "Chữ chính trên card" },
  { fg: "ink", bg: "surface-2", min: 4.5, use: "Chữ chính trên nền phụ" },
  { fg: "ink-2", bg: "bg", min: 4.5, use: "Đoạn văn phụ trên nền trang" },
  { fg: "ink-2", bg: "surface", min: 4.5, use: "Đoạn văn phụ trên card" },
  { fg: "muted", bg: "bg", min: 4.5, use: "Nhãn, chú thích trên nền trang" },
  { fg: "muted", bg: "surface", min: 4.5, use: "Nhãn, chú thích trên card" },
  { fg: "muted", bg: "surface-2", min: 4.5, use: "Nhãn trên nền phụ (skeleton, footer)" },
  { fg: "on-action", bg: "action", min: 4.5, use: "Chữ nút chính, chip đang chọn" },
  { fg: "on-action", bg: "action-hover", min: 4.5, use: "Chữ nút chính khi hover" },
  { fg: "action-text", bg: "bg", min: 4.5, use: "Liên kết, chữ nút phụ trên nền trang" },
  { fg: "action-text", bg: "surface", min: 4.5, use: "Liên kết, mục menu đang chọn trên card" },
  { fg: "action-text", bg: "surface-2", min: 4.5, use: "Liên kết trên nền phụ" },
  { fg: "accent", bg: "bg", min: 3, use: "Cụm nghiêng ở H1 (chữ lớn)" },
  { fg: "warn", bg: "warn-bg", min: 4.5, use: "Chữ cảnh báo trên nền cảnh báo" },
  { fg: "warn", bg: "surface", min: 4.5, use: "Chữ lỗi dưới ô nhập, nút nguy hiểm" },
  { fg: "ink", bg: "warn-bg", min: 4.5, use: "Chữ thường trong khối cảnh báo" },
  { fg: "ink", bg: "tag-bg", min: 4.5, use: "Chữ nhãn (tag)" },
  { fg: "action-text", bg: "surface", min: 3, use: "Viền ô nhập đang focus, outline focus trên card (phi văn bản)" },
  { fg: "action-text", bg: "bg", min: 3, use: "Outline focus bàn phím trên nền trang (phi văn bản)" },
  { fg: "warn", bg: "bg", min: 4.5, use: "Chữ cảnh báo trên nền trang" },
];
