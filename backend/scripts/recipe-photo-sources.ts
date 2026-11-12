/**
 * Đọc nguon.txt của thư mục ảnh món (upload:recipe-photos): mỗi dòng "slug|nguồn ảnh". Bỏ dòng trống, dòng bắt đầu bằng #, dòng thiếu
 * slug hoặc thiếu nguồn; nguồn được phép chứa "|" (chỉ tách ở dấu đầu tiên). Slug trùng: dòng sau thắng.
 */
export function readSources(text: string) {
  const sources = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [slug, ...rest] = trimmed.split("|");
    const source = rest.join("|").trim();
    if (slug.trim() && source) sources.set(slug.trim(), source);
  }
  return sources;
}
