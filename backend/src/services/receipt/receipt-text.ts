// Chuẩn hóa chữ cho quét hóa đơn. Hóa đơn siêu thị thường in KHÔNG dấu và viết hoa ("THIT HEO XAY"), nên mọi phép so
// khớp ở đây dùng bản bỏ dấu; tên hiển thị vẫn lấy bản có dấu khi ghép được với tên đã biết (receipt-normalize.ts).

/** Bỏ dấu, đ → d, chữ thường, ký tự khác chữ/số thành khoảng trắng: "Thịt heo xay (500g)" → "thit heo xay 500g". */
export function foldText(value: string) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").replace(/[đĐ]/g, "d").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Tên có chữ tiếng Việt có dấu không (để biết có nên giữ nguyên tên đọc được). */
export function hasVietnameseMarks(value: string) {
  return value.normalize("NFD") !== value.normalize("NFD").replace(/\p{M}/gu, "") || /[đĐ]/.test(value);
}

/** "THIT BO UC" → "Thit bo uc" (chỉ đổi khi cả tên viết hoa). */
export function sentenceCase(value: string) {
  if (value !== value.toUpperCase()) return value;
  const lower = value.toLocaleLowerCase("vi");
  return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1);
}
