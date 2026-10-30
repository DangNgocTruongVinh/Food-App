/**
 * Slug từ tên tiếng Việt: bỏ dấu, "đ" → "d", chữ thường, ký tự khác chữ/số thành "-".
 * Ví dụ "Cá kho tộ (kèm cơm)" → "ca-kho-to-kem-com". Tên không có chữ/số → "mon-an".
 */
export function slugifyVietnamese(value: string, maxLength = 80) {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "mon-an";
}

/** Slug chưa dùng: giữ nguyên nếu trống chỗ, ngược lại thêm hậu tố -2, -3, ... */
export function nextAvailableSlug(base: string, taken: Iterable<string>) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
