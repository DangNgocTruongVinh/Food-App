// Sinh docs/bao-cao/api.md từ mã: đọc mount trong backend/src/app.ts và mọi *.routes.ts (phương thức, đường dẫn, middleware quyền,
// rate limit, upload). Mô tả viết tay ở DESCRIPTIONS; route mới chưa có mô tả hoặc mô tả thừa (route đã bỏ) → script dừng báo lỗi.
//   node scripts/docs/gen-api.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const backend = join(root, "backend/src");
const app = readFileSync(join(backend, "app.ts"), "utf8");

// import xxxRoutes from "./modules/.../x.routes.js";  +  app.use("/api/...", xxxRoutes);
const imports = new Map([...app.matchAll(/import (\w+) from "\.\/(modules\/[^"]+\.routes)\.js";/g)].map((m) => [m[1], `${m[2]}.ts`]));
const mounts = [...app.matchAll(/app\.use\("([^"]+)", (\w+)\);/g)].map((m) => ({ prefix: m[1], file: imports.get(m[2]) }));

const LIMITS = {
  credentialsLimit: "20 lần/phút/IP", forgotIpLimit: "5 lần/giờ/IP", forgotEmailLimit: "5 lần/giờ/email", unsubscribeLimit: "20 lần/phút/IP",
};
const UPLOADS = { singleImageUpload: "multipart: 1 ảnh", communityPostImagesUpload: "multipart: ≤ 4 ảnh", receiptImageUpload: "multipart: 1 ảnh" };

const routes = [{ method: "GET", path: "/api/health", auth: "Công khai", notes: [] }];
for (const { prefix, file } of mounts) {
  const source = readFileSync(join(backend, file), "utf8");
  let scope = [];
  for (const line of source.split("\n")) {
    const use = /^router\.use\(([^)]*)\);/.exec(line.trim());
    if (use) { scope = use[1].split(",").map((name) => name.trim()); continue; }
    const route = /^router\.(get|post|put|patch|delete)\("([^"]+)",\s*(.*)$/.exec(line.trim());
    if (!route) continue;
    const middlewares = [...scope, ...route[3].split(",").map((part) => part.trim().replace(/\(.*$/, ""))];
    const auth = middlewares.includes("requireAdmin") ? "Admin" : middlewares.includes("requireAuth") ? "Đăng nhập" : "Công khai";
    const notes = [...middlewares.filter((name) => LIMITS[name]).map((name) => LIMITS[name]), ...middlewares.filter((name) => UPLOADS[name]).map((name) => UPLOADS[name])];
    routes.push({ method: route[1].toUpperCase(), path: `${prefix}${route[2] === "/" ? "" : route[2]}`, auth, notes, file });
  }
}

// Mô tả | dữ liệu vào chính | dữ liệu ra chính. Đối chiếu với service/schema tương ứng.
const DESCRIPTIONS = {
  "GET /api/health": ["Kiểm tra máy chủ sống; báo email đã cấu hình SMTP chưa", "—", "status, email.configured"],
  "POST /api/auth/register": ["Đăng ký (email chuẩn hóa chữ thường, bcrypt 12, tạo hồ sơ rỗng)", "email, password 8–72, name 2–80", "token, user + cookie refresh"],
  "POST /api/auth/login": ["Đăng nhập; tài khoản khóa → 403 ACCOUNT_LOCKED", "email, password, remember", "token, user + cookie refresh"],
  "POST /api/auth/refresh": ["Xoay vòng refresh token (cookie httpOnly); dùng lại token cũ → thu hồi cả chuỗi", "cookie nouri_refresh", "token, user + cookie mới"],
  "POST /api/auth/logout": ["Thu hồi refresh token, xóa cookie", "cookie", "204"],
  "POST /api/auth/forgot-password": ["Gửi liên kết đặt lại (token 32 byte, lưu SHA-256, 30 phút); luôn cùng một câu trả lời", "email", "message"],
  "POST /api/auth/reset-password": ["Đặt mật khẩu mới bằng token một lần; thu hồi mọi refresh token; email báo đổi", "token, password", "message"],
  "POST /api/auth/change-password": ["Đổi mật khẩu khi đang đăng nhập; đăng xuất thiết bị khác; email báo đổi", "currentPassword, newPassword", "token, user + cookie mới"],
  "GET /api/community": ["Bảng tin 30 bài mới (ẩn bài Admin ẩn / AI chờ duyệt với người khác), cảnh báo dị ứng theo người xem", "—", "bài viết, lượt thích, bình luận"],
  "POST /api/community": ["Đăng bài (chữ, ≤ 4 ảnh xóa EXIF lên Cloudinary, món có sẵn hoặc công thức tự viết); AI kiểm duyệt song song 8 giây", "content, recipeId | memberRecipe, images", "bài viết (pendingReview)"],
  "PATCH /api/community/:postId": ["Tác giả sửa nội dung / công thức tự viết; kiểm duyệt AI lại", "content, memberRecipe | null", "bài viết"],
  "DELETE /api/community/:postId": ["Tác giả xóa bài (service xóa dùng chung với Admin, xóa ảnh Cloudinary)", "—", "204"],
  "POST /api/community/:postId/like": ["Thích / bỏ thích (tạo/xóa thông báo cho tác giả)", "—", "liked, likeCount"],
  "POST /api/community/:postId/comments": ["Bình luận (≤ 500 ký tự), thông báo cho tác giả", "content", "bình luận"],
  "GET /api/notifications": ["Danh sách thông báo (đồng bộ cảnh báo kho trước khi trả)", "filter, limit", "thông báo"],
  "GET /api/notifications/unread-count": ["Số thông báo chưa đọc", "—", "count"],
  "PATCH /api/notifications/read-all": ["Đánh dấu tất cả đã đọc", "—", "số thông báo đã đánh dấu"],
  "PATCH /api/notifications/:id/read": ["Đánh dấu một thông báo đã đọc (chỉ của mình)", "—", "thông báo"],
  "POST /api/expiry-email/test": ["\"Gửi thử ngay\" email nhắc đồ sắp hết hạn (3 lần/ngày)", "—", "sent, emailConfigured, remainingToday"],
  "POST /api/expiry-email/unsubscribe": ["\"Tắt nhắc\" một chạm từ email (token HMAC riêng, không cần đăng nhập)", "userId, token", "message"],
  "GET /api/reports/waste": ["Báo cáo lãng phí theo tuần (Thứ Hai 00:00 giờ VN)", "weeks = 4 | 8", "weeks[], totals, byCategory, topCategory, comparison"],
  "GET /api/reports/nutrition": ["Dinh dưỡng 7 ngày từ bữa \"Đã ăn\" so với mục tiêu", "week = current | previous", "days[], average, targets"],
  "GET /api/profile": ["Hồ sơ người dùng + hồ sơ dinh dưỡng", "—", "user, profile"],
  "PUT /api/profile": ["Cập nhật hồ sơ, tính lại chỉ tiêu (BMR/TDEE, macro); cài đặt nhắc hạn email", "các trường hồ sơ (tùy chọn)", "user, profile"],
  "GET /api/pantry/receipt-scans/status": ["Chế độ quét dùng được, số lượt còn hôm nay", "—", "providers, defaultProvider, remainingToday"],
  "POST /api/pantry/receipt-scans": ["Nhận ảnh hóa đơn (xóa EXIF, thu nhỏ), đọc nền: Tự động / OpenAI / Tesseract", "image, provider", "id, provider, phase (202)"],
  "GET /api/pantry/receipt-scans/:id": ["Tiến trình và dòng nháp đã chuẩn hóa (giữ trong bộ nhớ 30 phút)", "—", "phase, progress, draft, fallbackCode"],
  "POST /api/pantry/receipt-scans/:id/commit": ["Lưu các dòng đã duyệt vào kho trong một transaction (một lần)", "lines[] ≤ 60", "added[]"],
  "POST /api/pantry/receipt-scans/:id/cancel": ["Hủy lần quét đang đọc", "—", "status FAILED"],
  "POST /api/pantry/receipt-scans/:id/undo": ["Hoàn tác cả lô đã lưu", "—", "restored[], skipped[]"],
  "GET /api/pantry": ["Danh sách kho (hạn gần trước)", "—", "PantryItem[]"],
  "GET /api/pantry/transactions": ["Lịch sử kho có phân trang", "source, pantryItemId, page, pageSize", "items, total"],
  "POST /api/pantry": ["Thêm thực phẩm (ghi lịch sử MANUAL_ADD)", "name, category, quantity, unit, expiryDate, unitPrice…", "PantryItem"],
  "PUT /api/pantry/:id": ["Sửa thực phẩm (ghi lịch sử MANUAL_EDIT)", "các trường (tùy chọn)", "PantryItem"],
  "DELETE /api/pantry/:id": ["Xóa kèm lý do (Báo cáo lãng phí)", "reason = USED_UP | DISCARDED | MISTAKE", "204"],
  "GET /api/recipes/stats": ["Số món theo nhóm cho Landing (công khai)", "—", "số đếm"],
  "GET /api/recipes/featured": ["Món nổi bật cho Landing (công khai)", "limit 1–12", "món"],
  "GET /api/recipes": ["Danh sách món (ẩn món đã ngừng), kèm `fit` theo hồ sơ", "search, cuisine", "món + fit"],
  "GET /api/recipes/:id": ["Chi tiết món kèm nguyên liệu, `fit`", "—", "món"],
  "GET /api/recipes/:id/for-you": ["Khối \"Dành cho bạn\" ở chi tiết món: nguyên liệu đã có trong kho, phần calo so với mục tiêu, cảnh báo theo hồ sơ", "—", "pantry, calories, warnings"],
  "GET /api/meal-plans": ["Danh sách thực đơn kèm ngày, bữa, đi chợ, gợi ý dinh dưỡng, cảnh báo bữa vi phạm", "—", "MealPlan[]"],
  "GET /api/meal-plans/:id": ["Chi tiết một thực đơn", "—", "MealPlan"],
  "POST /api/meal-plans/generate": ["Tạo thực đơn 7 ngày: OpenAI (kiểm lại qua safety) hoặc scoredPlan (thuật toán 3 + 0,3 × thuật toán 1)", "startDate", "MealPlan"],
  "POST /api/meal-plans/:id/items": ["Thêm món thủ công vào ngày/bữa; cập nhật danh sách đi chợ phần của bữa", "dayId, mealType, recipeId, servings", "MealPlan"],
  "PATCH /api/meal-plans/:id/status": ["Đổi trạng thái thực đơn của mình", "status = DRAFT | ACTIVE | COMPLETED", "MealPlan"],
  "GET /api/meal-plans/items/:id/consumption-preview": ["Xem trước lượng sẽ trừ kho khi \"Đã ăn\"", "—", "lines (nguyên liệu → thực phẩm)"],
  "POST /api/meal-plans/items/:id/swap": ["Đổi món vi phạm hồ sơ (server chọn món qua safety.ts)", "—", "MealPlan"],
  "DELETE /api/meal-plans/items/:id": ["Xóa một bữa, trừ phần đi chợ của bữa", "—", "MealPlan"],
  "PATCH /api/meal-plans/items/:id": ["Đánh dấu \"Đã ăn\" (tùy chọn trừ kho) / bỏ đánh dấu (hoàn lại kho)", "completed, consumption", "bữa + kết quả trừ kho"],
  "PATCH /api/meal-plans/shopping/:id": ["\"Đã mua\" → nhập kho (gộp/dùng lại/tạo mới, hạn ước tính) / bỏ → hoàn lại", "purchased", "món đi chợ + kết quả kho"],
  "DELETE /api/meal-plans/:id": ["Xóa thực đơn", "—", "204"],
  "GET /api/ai/status": ["OpenAI đã cấu hình chưa; chế độ quét hóa đơn", "—", "available, receiptScan"],
  "GET /api/ai/history": ["50 tin chat gần nhất, kèm cảnh báo dị ứng trên câu trả lời", "—", "ChatMessage[] + allergyWarnings"],
  "POST /api/ai/chat": ["Hỏi Nouri (hồ sơ, kho sắp hết hạn, thực đơn, 6 tin gần nhất); 30 câu/ngày; không key/lỗi → 503", "message 2–1000", "answer, allergyWarnings"],
  "GET /api/dashboard": ["Tổng quan: chỉ tiêu, kho sắp hết hạn, thực đơn đang áp dụng, dinh dưỡng hôm nay", "—", "dữ liệu tổng quan"],
  "GET /api/recommendations": ["Gợi ý món (lai 3 thuật toán + phổ biến, MMR, lọc an toàn)", "context, recipeId, pantryItemId, mealType, limit ≤ 50", "coldStart, items[] (món, lý do, điểm thành phần)"],
  "GET /api/admin/recipes": ["Danh sách món cho Admin (kể cả món ẩn), mức sử dụng", "search, status, page, pageSize", "items, total"],
  "POST /api/admin/recipes": ["Tạo món (kiểm nhãn chay/thuần chay); \"Chuyển thành công thức\" khi có sourcePostId; ghi nhật ký", "món + nguyên liệu, sourcePostId", "món"],
  "GET /api/admin/recipes/:id": ["Chi tiết món cho Admin", "—", "món"],
  "PUT /api/admin/recipes/:id": ["Sửa món; ghi nhật ký (tên trường đã đổi)", "món + nguyên liệu", "món"],
  "PATCH /api/admin/recipes/:id/visibility": ["Ẩn / hiện món (món đã dùng chỉ ẩn, không xóa)", "hidden", "món"],
  "PUT /api/admin/recipes/:id/image": ["Thay ảnh món (Cloudinary, xóa ảnh cũ sau khi lưu DB)", "image", "món"],
  "DELETE /api/admin/recipes/:id": ["Xóa món chưa được dùng", "—", "204"],
  "GET /api/admin/users": ["Danh sách người dùng", "search, page, pageSize", "items, total"],
  "PATCH /api/admin/users/:id/lock": ["Khóa / mở khóa (không khóa chính mình/Admin khác; khóa thu hồi refresh token)", "locked", "id, locked"],
  "GET /api/admin/community/posts": ["Bài cho kiểm duyệt; lọc \"AI đánh dấu\"", "page, pageSize, filter = all | ai", "items, total"],
  "GET /api/admin/community/posts/:postId": ["Một bài (form \"Chuyển thành công thức\")", "—", "bài"],
  "PATCH /api/admin/community/posts/:postId/visibility": ["Ẩn / hiện bài; ghi nhật ký", "hidden", "bài"],
  "PATCH /api/admin/community/posts/:postId/review": ["Bài AI đánh dấu: Duyệt (POST_APPROVE) / Ẩn (POST_HIDE)", "decision = approve | hide", "bài"],
  "POST /api/admin/community/posts/:postId/recipe-estimate": ["AI ước tính dinh dưỡng 1 khẩu phần + chuẩn hóa tên nguyên liệu (không lưu)", "—", "calories, proteinG, carbsG, fatG, ingredients[]"],
  "DELETE /api/admin/community/posts/:postId": ["Xóa bài vi phạm (service xóa dùng chung)", "—", "204"],
  "DELETE /api/admin/community/comments/:commentId": ["Xóa bình luận vi phạm", "—", "204"],
  "GET /api/admin/stats": ["Thống kê: tổng số và 12 tuần gần nhất (không tính tài khoản mẫu)", "—", "totals, weekly[]"],
  "GET /api/admin/audit-logs": ["Nhật ký thao tác Admin", "action, targetType, targetId, actorId, page, pageSize", "items, total"],
};

const keys = routes.map((route) => `${route.method} ${route.path}`);
const missing = keys.filter((key) => !DESCRIPTIONS[key]);
const stale = Object.keys(DESCRIPTIONS).filter((key) => !keys.includes(key));
if (missing.length || stale.length) {
  console.error(`Thiếu mô tả: ${missing.join(", ") || "—"}\nMô tả thừa: ${stale.join(", ") || "—"}`);
  process.exit(1);
}

const escape = (text) => text.replaceAll("|", "\\|");
const counts = routes.reduce((acc, route) => ({ ...acc, [route.auth]: (acc[route.auth] ?? 0) + 1 }), {});
const lines = [
  "# Danh sách API",
  "",
  `Sinh tự động từ \`backend/src/app.ts\` và các file \`*.routes.ts\` bằng \`node scripts/docs/gen-api.mjs\` (${new Date().toISOString().slice(0, 10)}).`,
  `Tổng ${routes.length} endpoint: ${Object.entries(counts).map(([auth, count]) => `${auth} ${count}`).join(", ")}.`,
  "",
  "Quy ước: \"Đăng nhập\" = `requireAuth` (JWT 15 phút, `userId` lấy từ token, đọc `role`/`lockedAt` từ DB mỗi request); \"Admin\" = thêm",
  "`requireAdmin`, mọi thao tác ghi `AdminAuditLog` trong cùng transaction. Dữ liệu vào được kiểm bằng Zod (`validate`); sai → 422.",
  "Dữ liệu của người khác hoặc không tồn tại → 404 (không lộ sự tồn tại).",
  "",
  "| # | Phương thức | Đường dẫn | Quyền | Mô tả | Vào chính | Ra chính |",
  "|---|---|---|---|---|---|---|",
  ...routes.map((route, index) => {
    const [description, input, output] = DESCRIPTIONS[`${route.method} ${route.path}`];
    const auth = [route.auth, ...route.notes].join("; ");
    return `| ${index + 1} | ${route.method} | \`${route.path}\` | ${escape(auth)} | ${escape(description)} | ${escape(input)} | ${escape(output)} |`;
  }),
  "",
];
writeFileSync(join(root, "docs/bao-cao/api.md"), lines.join("\n"), "utf8");
console.log(`Đã ghi docs/bao-cao/api.md: ${routes.length} endpoint.`);
