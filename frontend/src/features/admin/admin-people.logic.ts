import type { AdminUser, AuditAction, AuditLog, ModerationPost } from "./admin.api";

// Logic cho Người dùng, Kiểm duyệt, Nhật ký (UI-10). Giờ hiển thị theo giờ Việt Nam như backend thống kê.
import { vietnamTime } from "../../utils/date";

// Giờ Việt Nam dùng chung với Kho (lịch sử kho): định nghĩa ở utils/date.ts.
export { vietnamDate, vietnamTime } from "../../utils/date";

// ---------- Người dùng ----------

/** Vì sao không có nút khóa: chính mình hoặc Admin khác (khớp quy tắc backend 400/403); khóa được thì null. */
export function lockBlockedReason(user: Pick<AdminUser, "id" | "role">, currentUserId: string | undefined) {
  if (user.id === currentUserId) return "Tài khoản của bạn: không tự khóa được.";
  if (user.role === "ADMIN") return "Tài khoản quản trị viên: không khóa được quản trị viên khác.";
  return null;
}

export function lockConfirm(user: Pick<AdminUser, "name" | "email" | "locked">) {
  return user.locked
    ? {
      title: `Mở khóa ${user.email}?`,
      description: `${user.name} đăng nhập và dùng lại ứng dụng được ngay. Dữ liệu cũ vẫn còn nguyên.`,
      confirmLabel: "Mở khóa tài khoản",
    }
    : {
      title: `Khóa ${user.email}?`,
      description: `${user.name} bị đăng xuất ở lần thao tác tiếp theo và không đăng nhập hay dùng được ứng dụng cho tới khi được mở khóa. `
        + "Dữ liệu (kho, thực đơn, bài viết) vẫn giữ nguyên.",
      confirmLabel: "Khóa tài khoản",
    };
}

// ---------- Kiểm duyệt ----------

export function deletePostConfirmText(post: Pick<ModerationPost, "author" | "images" | "commentCount" | "likeCount">) {
  return {
    title: `Xóa bài của ${post.author.name}?`,
    description: `Bài của ${post.author.email} bị xóa cùng ${post.images.length} ảnh (xóa cả trên Cloudinary), ${post.commentCount} bình luận, `
      + `${post.likeCount} lượt thích và các thông báo liên quan. Không hoàn tác được.`,
    confirmLabel: "Xóa bài",
  };
}

/** Hộp xác nhận ẩn/hiện bài (ẩn: người khác không thấy nữa, tác giả vẫn thấy kèm ghi chú). */
export function postVisibilityConfirmText(post: Pick<ModerationPost, "author" | "hidden">) {
  return post.hidden
    ? { title: `Hiện lại bài của ${post.author.name}?`, description: "Bài sẽ hiện lại trên bảng tin cộng đồng.", confirmLabel: "Hiện lại bài" }
    : {
      title: `Ẩn bài của ${post.author.name}?`,
      description: "Người khác sẽ không thấy bài trên bảng tin; tác giả vẫn thấy kèm ghi chú. Có thể hiện lại sau.",
      confirmLabel: "Ẩn bài",
    };
}

export function deleteCommentConfirmText(comment: Pick<ModerationPost["comments"][number], "author">) {
  return {
    title: `Xóa bình luận của ${comment.author.name}?`,
    description: `Bình luận của ${comment.author.email} và thông báo liên quan bị xóa. Không hoàn tác được.`,
    confirmLabel: "Xóa bình luận",
  };
}

// ---------- Nhật ký ----------

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  RECIPE_CREATE: "Tạo món", RECIPE_UPDATE: "Sửa món", RECIPE_HIDE: "Ẩn món", RECIPE_SHOW: "Hiện lại món", RECIPE_DELETE: "Xóa món", RECIPE_RESTORE: "Khôi phục món",
  RECIPE_IMAGE_REPLACE: "Đổi ảnh món", USER_LOCK: "Khóa tài khoản", USER_UNLOCK: "Mở khóa tài khoản", POST_DELETE: "Xóa bài viết",
  COMMENT_DELETE: "Xóa bình luận", POST_HIDE: "Ẩn bài viết", POST_SHOW: "Hiện lại bài viết", POST_PROMOTE: "Chuyển thành công thức",
  POST_APPROVE: "Duyệt bài AI đánh dấu", CATALOG_CREATE: "Thêm vào danh mục", CATALOG_UPDATE: "Sửa danh mục",
};

const CATALOG_KIND_LABELS: Record<string, string> = {
  "allergen-groups": "nhóm dị ứng", "allergen-aliases": "tên gọi khác", "allergen-terms": "nguyên liệu thuộc nhóm",
  "food-categories": "nhóm thực phẩm", "receipt-abbreviations": "viết tắt hóa đơn",
};
const CATALOG_FIELD_LABELS: Record<string, string> = {
  label: "tên", name: "tên", parentId: "nhóm cha", hidden: "ẩn/hiện", level: "mức", processed: "chế biến/gia vị",
  defaultStorage: "nơi bảo quản", defaultShelfLifeDays: "hạn dùng", abbreviation: "chữ viết tắt", fullName: "tên đầy đủ",
};

const RECIPE_FIELD_LABELS: Record<string, string> = {
  name: "tên món", description: "mô tả", instructions: "các bước", prepMinutes: "thời gian sơ chế", cookMinutes: "thời gian nấu",
  servings: "khẩu phần", calories: "calo", proteinG: "đạm", carbsG: "tinh bột", fatG: "béo", fiberG: "chất xơ", cuisine: "ẩm thực",
  dietTags: "nhãn chế độ ăn", mealTypes: "bữa", imageUrl: "ảnh", ingredients: "nguyên liệu",
};

/** Đối tượng của dòng nhật ký: tên món / email / "Bài viết của …". */
export function auditTarget(log: Pick<AuditLog, "targetType" | "targetLabel">) {
  const label = log.targetLabel ?? "(không rõ)";
  if (log.targetType === "COMMUNITY_POST") return `Bài viết của ${label}`;
  if (log.targetType === "COMMUNITY_COMMENT") return `Bình luận của ${label}`;
  return label;
}

/** Chi tiết dễ đọc từ `details` (danh sách trường cố định, không có nội dung bài/bình luận). */
export function auditDetails(log: Pick<AuditLog, "action" | "details">) {
  const details = log.details ?? {};
  const count = (key: string) => Number(details[key] ?? 0);
  switch (log.action) {
    case "RECIPE_UPDATE": {
      const fields = (details.changedFields as string[] | undefined) ?? [];
      return fields.length ? `Đổi ${fields.map((field) => RECIPE_FIELD_LABELS[field] ?? field).join(", ")}` : "Không đổi trường nào";
    }
    case "RECIPE_CREATE":
    case "RECIPE_RESTORE":
      return details.slug ? `Đường dẫn: ${String(details.slug)}` : "";
    case "RECIPE_DELETE": {
      const mode = details.soft === true ? "Xóa mềm (món đang được dùng)" : details.soft === false ? "Xóa hẳn" : "";
      return [mode, details.slug ? `đường dẫn: ${String(details.slug)}` : ""].filter(Boolean).join(", ");
    }
    case "RECIPE_IMAGE_REPLACE":
      return details.replacedUploadedImage ? "Thay ảnh đã tải lên trước đó (ảnh cũ đã xóa)" : "Tải ảnh lên lần đầu";
    case "POST_DELETE":
      return `${count("imageCount")} ảnh, ${count("commentCount")} bình luận, ${count("likeCount")} lượt thích${details.hasRecipe ? ", có công thức đính kèm" : ""}`;
    case "COMMENT_DELETE":
      return "Xóa một bình luận trong bài";
    case "CATALOG_CREATE":
      return `Thêm ${CATALOG_KIND_LABELS[String(details.kind)] ?? "mục"}`;
    case "CATALOG_UPDATE": {
      const fields = ((details.changedFields as string[] | undefined) ?? []).map((field) => CATALOG_FIELD_LABELS[field] ?? field);
      return `${CATALOG_KIND_LABELS[String(details.kind)] ?? "Mục"}: đổi ${fields.join(", ")}`;
    }
    case "POST_PROMOTE":
      return details.recipeName ? `Thêm vào thư viện: ${String(details.recipeName)}` : "Thêm công thức tự viết vào thư viện";
    default:
      return "";
  }
}

/** Link mở nhanh đối tượng còn tồn tại: món → trang sửa; tài khoản → trang Người dùng lọc theo email. Bài/bình luận đã xóa: không có link. */
export function auditTargetLink(log: Pick<AuditLog, "targetType" | "targetId" | "targetLabel">, existing: { recipes: Set<string>; users: Set<string> }) {
  if (log.targetType === "RECIPE" && existing.recipes.has(log.targetId)) return `/admin/recipes/${log.targetId}/edit`;
  if (log.targetType === "USER" && existing.users.has(log.targetId)) return `/admin/users?search=${encodeURIComponent(log.targetLabel ?? "")}`;
  if (log.targetType === "CATALOG") return "/admin/catalog";
  return null;
}
