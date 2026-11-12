import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Kiểm kê nút, ô nhập, liên kết và hộp xác nhận của khu Admin (viết trước khi làm lại giao diện Admin): đọc mã nguồn các thư mục
// Admin, mỗi mục dưới đây phải còn. Bỏ một mục chỉ khi người dùng đã duyệt (ghi lý do ở đây).
const srcRoot = fileURLToPath(new URL("../..", import.meta.url));
const ADMIN_SOURCES = ["pages/admin", "components/admin", "features/admin", "layouts/AdminLayout.tsx"];

function sourceOf(path: string): string {
  const full = join(srcRoot, path);
  if (extname(path)) return readFileSync(full, "utf8");
  return readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || ([".ts", ".tsx"].includes(extname(entry.name)) && !entry.name.endsWith(".test.ts")))
    .map((entry) => sourceOf(join(path, entry.name)))
    .join("\n");
}

const adminSource = ADMIN_SOURCES.map(sourceOf).join("\n");

const CONTROLS: Record<string, string[]> = {
  "điều hướng Admin": ["/admin/recipes", "/admin/users", "/admin/moderation", "/admin/audit-logs", "Công thức", "Người dùng", "Kiểm duyệt", "Nhật ký"],
  "Tổng quan (thống kê)": ["Đang tải thống kê", "AdminWeeklyChart"],
  "Công thức — danh sách": [
    // ra-soat-cuoi: ô tìm theo tên mở rộng thành tìm cả nguyên liệu/ẩm thực (searchRecipes dùng chung); thêm "Đã xóa" + "Khôi phục".
    "Tạo món", "Tìm món, nguyên liệu, ẩm thực", "Lọc theo trạng thái", "Đã xóa", "`Khôi phục ${recipe.name}`", "`Sửa ${recipe.name}`", "`Hiện lại ${recipe.name}`", "`Ẩn ${recipe.name}`",
    "`Xóa ${recipe.name}`", "\"Ẩn món\"", "\"Xóa món\"", "Phân trang công thức",
  ],
  "Công thức — thêm/sửa": [
    "Lưu thay đổi", "Đang lưu...", ">Hủy<", "Danh sách công thức", "Thêm nguyên liệu", "Thêm bước", "`Chuyển ${label} lên`", "`Chuyển ${label} xuống`",
    "`Xóa ${label}`", "Chọn ảnh khác", "Tải ảnh l", "Bỏ ảnh đã chọn", "Bỏ ảnh hiện tại",
  ],
  "Người dùng": ["Tìm theo tên hoặc email", "Mở khóa", "Khóa", "Mở khóa tài khoản", "Khóa tài khoản", "Tài khoản mẫu", "Phân trang người dùng"],
  "Kiểm duyệt": [
    "Xóa bài", "`Xóa bài của ${post.author.name}`", "`Xóa bình luận của ${comment.author.name}`", "\"Xóa bình luận\"", "Phân trang bài viết",
    "Chuyển thành công thức", "\"Ẩn bài\"", "\"Hiện lại bài\"", "fromPost",
    // AI kiểm duyệt (giai-doan-ai): lọc bài AI đánh dấu, lý do, Duyệt/Ẩn.
    "AI đánh dấu", "Duyệt bài", "`Duyệt bài của ${post.author.name}`", "`Ẩn bài AI đánh dấu của ${post.author.name}`", "aiReviewReason",
  ],
  "Nhật ký": ["Nhật ký thao tác", "Phân trang nhật ký", "Chưa có thao tác quản trị nào."],
  "phân trang chung": ["Trang trước", "Trang sau"],
};

describe("Admin keeps every existing control (inventory)", () => {
  for (const [area, controls] of Object.entries(CONTROLS)) {
    it(`still has every control of ${area}`, () => {
      expect(controls.filter((control) => !adminSource.includes(control))).toEqual([]);
    });
  }
});
