/**
 * Chữ cái đầu cho ảnh đại diện chữ, dùng chung cho thanh trên (tài khoản, Admin) và Cộng đồng: chữ đầu của hai từ cuối trong tên
 * (tên Việt: tên đệm + tên, "Nguyễn Linh Nhi" → "LN"), viết hoa theo tiếng Việt; tên trống → "N".
 */
export function nameInitials(name: string | null | undefined) {
  const letters = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part.charAt(0).toLocaleUpperCase("vi")).join("");
  return letters || "N";
}
