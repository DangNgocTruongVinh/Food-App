# Danh sách API

Sinh tự động từ `backend/src/app.ts` và các file `*.routes.ts` bằng `node scripts/docs/gen-api.mjs` (2026-11-12).
Tổng 74 endpoint: Công khai 10, Đăng nhập 46, Admin 18.

Quy ước: "Đăng nhập" = `requireAuth` (JWT 15 phút, `userId` lấy từ token, đọc `role`/`lockedAt` từ DB mỗi request); "Admin" = thêm
`requireAdmin`, mọi thao tác ghi `AdminAuditLog` trong cùng transaction. Dữ liệu vào được kiểm bằng Zod (`validate`); sai → 422.
Dữ liệu của người khác hoặc không tồn tại → 404 (không lộ sự tồn tại).

| # | Phương thức | Đường dẫn | Quyền | Mô tả | Vào chính | Ra chính |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/health` | Công khai | Kiểm tra máy chủ sống; báo email đã cấu hình SMTP chưa | — | status, email.configured |
| 2 | POST | `/api/auth/register` | Công khai; 20 lần/phút/IP | Đăng ký (email chuẩn hóa chữ thường, bcrypt 12, tạo hồ sơ rỗng) | email, password 8–72, name 2–80 | token, user + cookie refresh |
| 3 | POST | `/api/auth/login` | Công khai; 20 lần/phút/IP | Đăng nhập; tài khoản khóa → 403 ACCOUNT_LOCKED | email, password, remember | token, user + cookie refresh |
| 4 | POST | `/api/auth/refresh` | Công khai | Xoay vòng refresh token (cookie httpOnly); dùng lại token cũ → thu hồi cả chuỗi | cookie nouri_refresh | token, user + cookie mới |
| 5 | POST | `/api/auth/logout` | Công khai | Thu hồi refresh token, xóa cookie | cookie | 204 |
| 6 | POST | `/api/auth/forgot-password` | Công khai; 5 lần/giờ/IP; 5 lần/giờ/email | Gửi liên kết đặt lại (token 32 byte, lưu SHA-256, 30 phút); luôn cùng một câu trả lời | email | message |
| 7 | POST | `/api/auth/reset-password` | Công khai; 20 lần/phút/IP | Đặt mật khẩu mới bằng token một lần; thu hồi mọi refresh token; email báo đổi | token, password | message |
| 8 | POST | `/api/auth/change-password` | Đăng nhập | Đổi mật khẩu khi đang đăng nhập; đăng xuất thiết bị khác; email báo đổi | currentPassword, newPassword | token, user + cookie mới |
| 9 | GET | `/api/community` | Đăng nhập | Bảng tin 30 bài mới (ẩn bài Admin ẩn / AI chờ duyệt với người khác), cảnh báo dị ứng theo người xem | — | bài viết, lượt thích, bình luận |
| 10 | POST | `/api/community` | Đăng nhập; multipart: ≤ 4 ảnh | Đăng bài (chữ, ≤ 4 ảnh xóa EXIF lên Cloudinary, món có sẵn hoặc công thức tự viết); AI kiểm duyệt song song 8 giây | content, recipeId \| memberRecipe, images | bài viết (pendingReview) |
| 11 | PATCH | `/api/community/:postId` | Đăng nhập | Tác giả sửa nội dung / công thức tự viết; kiểm duyệt AI lại | content, memberRecipe \| null | bài viết |
| 12 | DELETE | `/api/community/:postId` | Đăng nhập | Tác giả xóa bài (service xóa dùng chung với Admin, xóa ảnh Cloudinary) | — | 204 |
| 13 | POST | `/api/community/:postId/like` | Đăng nhập | Thích / bỏ thích (tạo/xóa thông báo cho tác giả) | — | liked, likeCount |
| 14 | POST | `/api/community/:postId/comments` | Đăng nhập | Bình luận (≤ 500 ký tự), thông báo cho tác giả | content | bình luận |
| 15 | GET | `/api/notifications` | Đăng nhập | Danh sách thông báo (đồng bộ cảnh báo kho trước khi trả) | filter, limit | thông báo |
| 16 | GET | `/api/notifications/unread-count` | Đăng nhập | Số thông báo chưa đọc | — | count |
| 17 | PATCH | `/api/notifications/read-all` | Đăng nhập | Đánh dấu tất cả đã đọc | — | số thông báo đã đánh dấu |
| 18 | PATCH | `/api/notifications/:id/read` | Đăng nhập | Đánh dấu một thông báo đã đọc (chỉ của mình) | — | thông báo |
| 19 | POST | `/api/expiry-email/test` | Đăng nhập | "Gửi thử ngay" email nhắc đồ sắp hết hạn (3 lần/ngày) | — | sent, emailConfigured, remainingToday |
| 20 | POST | `/api/expiry-email/unsubscribe` | Công khai; 20 lần/phút/IP | "Tắt nhắc" một chạm từ email (token HMAC riêng, không cần đăng nhập) | userId, token | message |
| 21 | GET | `/api/reports/waste` | Đăng nhập | Báo cáo lãng phí theo tuần (Thứ Hai 00:00 giờ VN) | weeks = 4 \| 8 | weeks[], totals, byCategory, topCategory, comparison |
| 22 | GET | `/api/reports/nutrition` | Đăng nhập | Dinh dưỡng 7 ngày từ bữa "Đã ăn" so với mục tiêu | week = current \| previous | days[], average, targets |
| 23 | GET | `/api/profile` | Đăng nhập | Hồ sơ người dùng + hồ sơ dinh dưỡng | — | user, profile |
| 24 | PUT | `/api/profile` | Đăng nhập | Cập nhật hồ sơ, tính lại chỉ tiêu (BMR/TDEE, macro); cài đặt nhắc hạn email | các trường hồ sơ (tùy chọn) | user, profile |
| 25 | GET | `/api/pantry/receipt-scans/status` | Đăng nhập | Chế độ quét dùng được, số lượt còn hôm nay | — | providers, defaultProvider, remainingToday |
| 26 | POST | `/api/pantry/receipt-scans` | Đăng nhập; multipart: 1 ảnh | Nhận ảnh hóa đơn (xóa EXIF, thu nhỏ), đọc nền: Tự động / OpenAI / Tesseract | image, provider | id, provider, phase (202) |
| 27 | GET | `/api/pantry/receipt-scans/:id` | Đăng nhập | Tiến trình và dòng nháp đã chuẩn hóa (giữ trong bộ nhớ 30 phút) | — | phase, progress, draft, fallbackCode |
| 28 | POST | `/api/pantry/receipt-scans/:id/commit` | Đăng nhập | Lưu các dòng đã duyệt vào kho trong một transaction (một lần) | lines[] ≤ 60 | added[] |
| 29 | POST | `/api/pantry/receipt-scans/:id/cancel` | Đăng nhập | Hủy lần quét đang đọc | — | status FAILED |
| 30 | POST | `/api/pantry/receipt-scans/:id/undo` | Đăng nhập | Hoàn tác cả lô đã lưu | — | restored[], skipped[] |
| 31 | GET | `/api/pantry` | Đăng nhập | Danh sách kho (hạn gần trước) | — | PantryItem[] |
| 32 | GET | `/api/pantry/transactions` | Đăng nhập | Lịch sử kho có phân trang | source, pantryItemId, page, pageSize | items, total |
| 33 | POST | `/api/pantry` | Đăng nhập | Thêm thực phẩm (ghi lịch sử MANUAL_ADD) | name, category, quantity, unit, expiryDate, unitPrice… | PantryItem |
| 34 | PUT | `/api/pantry/:id` | Đăng nhập | Sửa thực phẩm (ghi lịch sử MANUAL_EDIT) | các trường (tùy chọn) | PantryItem |
| 35 | DELETE | `/api/pantry/:id` | Đăng nhập | Xóa kèm lý do (Báo cáo lãng phí) | reason = USED_UP \| DISCARDED \| MISTAKE | 204 |
| 36 | GET | `/api/recipes/stats` | Công khai | Số món theo nhóm cho Landing (công khai) | — | số đếm |
| 37 | GET | `/api/recipes/featured` | Công khai | Món nổi bật cho Landing (công khai) | limit 1–12 | món |
| 38 | GET | `/api/recipes` | Đăng nhập | Danh sách món (ẩn món đã ngừng), kèm `fit` theo hồ sơ | search, cuisine | món + fit |
| 39 | GET | `/api/recipes/:id` | Đăng nhập | Chi tiết món kèm nguyên liệu, `fit` | — | món |
| 40 | GET | `/api/recipes/:id/for-you` | Đăng nhập | Khối "Dành cho bạn" ở chi tiết món: nguyên liệu đã có trong kho, phần calo so với mục tiêu, cảnh báo theo hồ sơ | — | pantry, calories, warnings |
| 41 | GET | `/api/meal-plans` | Đăng nhập | Danh sách thực đơn kèm ngày, bữa, đi chợ, gợi ý dinh dưỡng, cảnh báo bữa vi phạm | — | MealPlan[] |
| 42 | GET | `/api/meal-plans/:id` | Đăng nhập | Chi tiết một thực đơn | — | MealPlan |
| 43 | POST | `/api/meal-plans/generate` | Đăng nhập | Tạo thực đơn 7 ngày: OpenAI (kiểm lại qua safety) hoặc scoredPlan (thuật toán 3 + 0,3 × thuật toán 1) | startDate | MealPlan |
| 44 | POST | `/api/meal-plans/:id/items` | Đăng nhập | Thêm món thủ công vào ngày/bữa; cập nhật danh sách đi chợ phần của bữa | dayId, mealType, recipeId, servings | MealPlan |
| 45 | PATCH | `/api/meal-plans/:id/status` | Đăng nhập | Đổi trạng thái thực đơn của mình | status = DRAFT \| ACTIVE \| COMPLETED | MealPlan |
| 46 | GET | `/api/meal-plans/items/:id/consumption-preview` | Đăng nhập | Xem trước lượng sẽ trừ kho khi "Đã ăn" | — | lines (nguyên liệu → thực phẩm) |
| 47 | POST | `/api/meal-plans/items/:id/swap` | Đăng nhập | Đổi món vi phạm hồ sơ (server chọn món qua safety.ts) | — | MealPlan |
| 48 | DELETE | `/api/meal-plans/items/:id` | Đăng nhập | Xóa một bữa, trừ phần đi chợ của bữa | — | MealPlan |
| 49 | PATCH | `/api/meal-plans/items/:id` | Đăng nhập | Đánh dấu "Đã ăn" (tùy chọn trừ kho) / bỏ đánh dấu (hoàn lại kho) | completed, consumption | bữa + kết quả trừ kho |
| 50 | PATCH | `/api/meal-plans/shopping/:id` | Đăng nhập | "Đã mua" → nhập kho (gộp/dùng lại/tạo mới, hạn ước tính) / bỏ → hoàn lại | purchased | món đi chợ + kết quả kho |
| 51 | DELETE | `/api/meal-plans/:id` | Đăng nhập | Xóa thực đơn | — | 204 |
| 52 | GET | `/api/ai/status` | Đăng nhập | OpenAI đã cấu hình chưa; chế độ quét hóa đơn | — | available, receiptScan |
| 53 | GET | `/api/ai/history` | Đăng nhập | 50 tin chat gần nhất, kèm cảnh báo dị ứng trên câu trả lời | — | ChatMessage[] + allergyWarnings |
| 54 | POST | `/api/ai/chat` | Đăng nhập | Hỏi Nouri (hồ sơ, kho sắp hết hạn, thực đơn, 6 tin gần nhất); 30 câu/ngày; không key/lỗi → 503 | message 2–1000 | answer, allergyWarnings |
| 55 | GET | `/api/dashboard` | Đăng nhập | Tổng quan: chỉ tiêu, kho sắp hết hạn, thực đơn đang áp dụng, dinh dưỡng hôm nay | — | dữ liệu tổng quan |
| 56 | GET | `/api/recommendations` | Đăng nhập | Gợi ý món (lai 3 thuật toán + phổ biến, MMR, lọc an toàn) | context, recipeId, pantryItemId, mealType, limit ≤ 50 | coldStart, items[] (món, lý do, điểm thành phần) |
| 57 | GET | `/api/admin/recipes` | Admin | Danh sách món cho Admin (kể cả món ẩn), mức sử dụng | search, status, page, pageSize | items, total |
| 58 | POST | `/api/admin/recipes` | Admin | Tạo món (kiểm nhãn chay/thuần chay); "Chuyển thành công thức" khi có sourcePostId; ghi nhật ký | món + nguyên liệu, sourcePostId | món |
| 59 | GET | `/api/admin/recipes/:id` | Admin | Chi tiết món cho Admin | — | món |
| 60 | PUT | `/api/admin/recipes/:id` | Admin | Sửa món; ghi nhật ký (tên trường đã đổi) | món + nguyên liệu | món |
| 61 | PATCH | `/api/admin/recipes/:id/visibility` | Admin | Ẩn / hiện món (món đã dùng chỉ ẩn, không xóa) | hidden | món |
| 62 | PUT | `/api/admin/recipes/:id/image` | Admin; multipart: 1 ảnh | Thay ảnh món (Cloudinary, xóa ảnh cũ sau khi lưu DB) | image | món |
| 63 | DELETE | `/api/admin/recipes/:id` | Admin | Xóa món chưa được dùng | — | 204 |
| 64 | GET | `/api/admin/users` | Admin | Danh sách người dùng | search, page, pageSize | items, total |
| 65 | PATCH | `/api/admin/users/:id/lock` | Admin | Khóa / mở khóa (không khóa chính mình/Admin khác; khóa thu hồi refresh token) | locked | id, locked |
| 66 | GET | `/api/admin/community/posts` | Admin | Bài cho kiểm duyệt; lọc "AI đánh dấu" | page, pageSize, filter = all \| ai | items, total |
| 67 | GET | `/api/admin/community/posts/:postId` | Admin | Một bài (form "Chuyển thành công thức") | — | bài |
| 68 | PATCH | `/api/admin/community/posts/:postId/visibility` | Admin | Ẩn / hiện bài; ghi nhật ký | hidden | bài |
| 69 | PATCH | `/api/admin/community/posts/:postId/review` | Admin | Bài AI đánh dấu: Duyệt (POST_APPROVE) / Ẩn (POST_HIDE) | decision = approve \| hide | bài |
| 70 | POST | `/api/admin/community/posts/:postId/recipe-estimate` | Admin | AI ước tính dinh dưỡng 1 khẩu phần + chuẩn hóa tên nguyên liệu (không lưu) | — | calories, proteinG, carbsG, fatG, ingredients[] |
| 71 | DELETE | `/api/admin/community/posts/:postId` | Admin | Xóa bài vi phạm (service xóa dùng chung) | — | 204 |
| 72 | DELETE | `/api/admin/community/comments/:commentId` | Admin | Xóa bình luận vi phạm | — | 204 |
| 73 | GET | `/api/admin/stats` | Admin | Thống kê: tổng số và 12 tuần gần nhất (không tính tài khoản mẫu) | — | totals, weekly[] |
| 74 | GET | `/api/admin/audit-logs` | Admin | Nhật ký thao tác Admin | action, targetType, targetId, actorId, page, pageSize | items, total |
