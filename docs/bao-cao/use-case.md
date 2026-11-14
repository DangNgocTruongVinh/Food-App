# Đối chiếu Use Case với mã nguồn

Đối chiếu UC01–UC26 (mục 12 `REPORT_NOURI.md`, khảo sát mã ban đầu) với mã hiện tại (12/11/2026, gồm nhánh `uc24-uc25`), rồi bổ sung các use case
mới phát sinh ngoài khảo sát. Trạng thái: **Đã làm** (đúng như mô tả), **Làm khác** (có, nhưng khác/mở rộng — ghi rõ khác gì),
**Chưa làm**. Đường dẫn file tính từ thư mục gốc repo. Danh sách API đầy đủ: `docs/bao-cao/api.md`.

Tác nhân: **Khách** (chưa đăng nhập), **Người dùng** (đã đăng nhập, vai trò USER), **Admin** (vai trò ADMIN, tạo bằng seed),
**OpenAI** (dịch vụ ngoài, tùy chọn), **Cloudinary** (lưu ảnh), **SMTP** (gửi email), **Bộ lập lịch** (node-cron trong backend).

## 1. Đối chiếu UC01–UC26

| UC | Tên | Khảo sát | Hiện tại | Khác gì / ghi chú | Bằng chứng chính |
|---|---|---|---|---|---|
| UC01 | Đăng ký tài khoản | DONE | Làm khác | Email chuẩn hóa chữ thường; rate limit 20 lần/phút/IP; trả access token 15 phút + refresh token trong cookie httpOnly (GĐ4) thay JWT dài hạn | `backend/src/modules/auth/auth.service.ts` (`register`), `auth.routes.ts` |
| UC02 | Đăng nhập | DONE | Làm khác | Access 15 phút + refresh xoay vòng; "Nhớ đăng nhập" → localStorage, không tick → sessionStorage; tài khoản khóa → 403; Admin vào thẳng `/admin` | `auth.service.ts` (`login`), `refresh-token.service.ts`, `frontend/src/features/auth/auth.storage.ts`, `features/layout/layout.logic.ts` (`postLoginPath`) |
| UC03 | Đăng xuất | PARTIAL | Đã làm | Có thu hồi phía server (`POST /api/auth/logout` thu hồi refresh token, xóa cookie) — đúng điều khảo sát ghi là thiếu | `auth.controller.ts` (`logoutController`), `frontend/src/contexts/AuthContext.tsx` |
| UC04 | Xem hồ sơ dinh dưỡng | DONE | Đã làm | Giao diện làm lại (UI-1…12) | `frontend/src/pages/ProfilePage.tsx`, `backend/src/modules/profile/profile.service.ts` |
| UC05 | Cập nhật hồ sơ, tính lại chỉ tiêu | DONE | Làm khác | Thêm: cài đặt nhắc đồ sắp hết hạn qua email; đổi mật khẩu trong Hồ sơ. Dị ứng / món không thích: ô gợi ý tự động theo danh mục nhóm dị ứng (tên nhóm, tên gọi khác, nguyên liệu, "nhóm …"), không trùng nhóm, mục chưa nhận ra vẫn thêm kèm nhắc và "Có phải bạn muốn…", dòng "Sẽ tránh: …" (13/11/2026) | `profile.service.ts` (`updateProfile`), `frontend/src/components/profile/ExpiryEmailCard.tsx`, `ChangePasswordForm.tsx` |
| UC06 | Quản lý kho thực phẩm | DONE | Làm khác | Mọi thay đổi ghi lịch sử kho (`PantryTransaction`) cùng transaction; xóa phải chọn lý do (Đã dùng hết / Bỏ đi / Nhập nhầm); đơn giá tùy chọn; 8 nhóm thực phẩm; `?item=` cuộn tới thực phẩm | `backend/src/modules/pantry/pantry.service.ts`, `pantry-history.service.ts`, `frontend/src/pages/PantryPage.tsx`, `components/pantry/RemovePantryItemDialog.tsx` |
| UC07 | Tra cứu, lọc công thức | DONE | Làm khác | Tìm dùng chung `searchRecipes` (không dấu, nhiều từ, nguyên liệu, ẩm thực); ô tìm có gợi ý tự động (món bị ẩn theo hồ sơ ghi nhãn); mặc định ẩn món vi phạm dị ứng (theo nhóm, mọi cách gõ)/chế độ ăn (nút "Hiện tất cả"), thẻ món ghi "Chứa: nhóm (nguyên liệu)"; món không thích chỉ gắn nhãn; món Admin ẩn không hiện | `backend/src/modules/recipes/recipes.service.ts`, `services/recipe-fit.service.ts`, `frontend/src/pages/RecipesPage.tsx` |
| UC08 | Xem chi tiết công thức | BACKEND ONLY | Đã làm | Có trang `/recipes/:id`: nguyên liệu, khối "Dành cho bạn" (đã có trong kho, phần calo, cảnh báo), món tương tự, "Thêm vào thực đơn" | `frontend/src/pages/RecipeDetailPage.tsx`, `recipes.service.ts` (`getRecipeForYou`) |
| UC09 | Tạo thực đơn 7 ngày | DONE (AI PARTIAL) | Làm khác | Mặc định "Tạo thực đơn": bộ tạo thuật toán `scoredPlan` (thuật toán 3 + 0,3 × thuật toán 1, kho ảo, không lặp 3 ngày, calo ±35 %), có kết quả ngay. Lựa chọn phụ "Tạo bằng AI (1–2 phút)" (chỉ khi có key): chạy nền (`POST /generate` mode `ai` trả 202, giao diện hỏi `GET /generate/current`, được rời trang, xong có thông báo), kết quả OpenAI kiểm lại qua `reconcileAIPlan`; lỗi/quá 120 giây/không hợp lệ → `scoredPlan` và báo lý do | `backend/src/modules/meal-plans/meal-plans.service.ts`, `meal-plan-jobs.ts`, `meal-plan-generator.ts` (`reconcileAIPlan`), `meal-plan-scorer.ts` (`scoredPlan`), `docs/thuat-toan-goi-y.md` mục 9 |
| UC10 | Xem, chọn thực đơn đã lưu | DONE | Đã làm | Kèm gợi ý dinh dưỡng tính ở backend, cảnh báo bữa vi phạm hồ sơ | `frontend/src/pages/MealPlansPage.tsx`, `meal-plan-suggestions.ts` |
| UC11 | Kích hoạt thực đơn | DONE | Đã làm | — | `meal-plans.service.ts` (`updateMealPlanStatus`) |
| UC12 | Đánh dấu bữa đã ăn | DONE | Làm khác | "Đã ăn" có hộp xem trước và trừ kho (lượng = số lượng × khẩu phần bữa / khẩu phần món, quy đổi g↔kg, ml↔l); bỏ đánh dấu → hoàn lại kho | `backend/src/modules/meal-plans/meal-consumption.service.ts`, `services/pantry-consumption.ts` |
| UC13 | Theo dõi nguyên liệu đã mua | DONE | Làm khác | "Đã mua" → nhập kho (gộp / dùng lại món đã hết / tạo mới, hạn ước tính theo nhóm); bỏ tick → hoàn lại | `backend/src/modules/pantry/pantry-intake.ts`, `services/pantry-purchase.ts` |
| UC14 | Xem chi tiết thực đơn qua endpoint | BACKEND ONLY | Đã làm | Giao diện mở thực đơn theo URL `/meal-plans/:id` (`GET /api/meal-plans/:id`) | `frontend/src/pages/MealPlansPage.tsx` (`mealPlanQueries.detail`) |
| UC15 | Xóa thực đơn | BACKEND ONLY | Đã làm | Nút "Xóa thực đơn" có hộp xác nhận | `frontend/src/components/meal-plans/MealPlanHeader.tsx`, `MealPlansPage.tsx` |
| UC16 | Xem lịch sử chat AI | DONE (+ UI ONLY) | Đã làm | Lịch sử giả khi rỗng đã gỡ (GĐ1); "Xem tất cả" mở rộng toàn bộ lịch sử đã tải; mỗi câu trả lời kèm cảnh báo dị ứng nếu có | `frontend/src/pages/AiAssistantPage.tsx`, `backend/src/modules/ai/chat.service.ts` (`listChatHistory`) |
| UC17 | Hỏi trợ lý dinh dưỡng AI | PARTIAL | Làm khác | Không key / OpenAI lỗi → 503, không lưu câu trả lời mẫu, gợi ý "Gợi ý cho bạn"/"Nấu gì từ kho?"; 30 câu/ngày; ngữ cảnh thêm đồ sắp hết hạn và 6 tin gần nhất; prompt cố định về dị ứng và chủ đề | `chat.service.ts`, `chat-context.ts`, `ai.prompts.ts` |
| UC18 | Xem Tổng quan | DONE | Đã làm | Giao diện làm lại; thêm "Gợi ý cho bạn" từ bộ gợi ý | `frontend/src/pages/DashboardPage.tsx`, `backend/src/modules/dashboard/dashboard.service.ts` |
| UC19 | Xem bảng tin cộng đồng | DONE | Đã làm | Bài Admin ẩn / AI chờ duyệt chỉ tác giả thấy | `backend/src/modules/community/community.service.ts` (`visiblePostWhere`) |
| UC20 | Đăng bài cộng đồng | DONE (chữ) | Làm khác | Thêm ảnh (≤ 4, xóa EXIF, Cloudinary), gắn món có sẵn hoặc công thức tự viết, sửa/xóa bài của mình, AI kiểm duyệt | `community.service.ts`, `community-member-recipe.ts`, `community-ai-review.ts` |
| UC21 | Thích / bỏ thích | DONE | Đã làm | — | `community.service.ts` (`toggleCommunityLike`) |
| UC22 | Bình luận | DONE | Đã làm | — | `community.service.ts` (`addCommunityComment`) |
| UC23 | Xem, đánh dấu thông báo | DONE | Đã làm | — | `backend/src/modules/notifications/notifications.service.ts` |
| UC24 | Yêu thích công thức | UI ONLY | Đã làm | Bảng `FavoriteRecipe` + API; trái tim ở thẻ món và chi tiết món; trang "Món yêu thích" (`/recipes/favorites`, từ Công thức hoặc menu tài khoản). Yêu thích cũng là tín hiệu "thích" cho bộ gợi ý (cùng loại `LIKED`, không đổi trọng số) | `backend/src/modules/recipes/recipes.service.ts` (`setRecipeFavorite`, `listFavoriteRecipes`), `modules/recommendation/interaction-loader.ts`, `frontend/src/components/recipes/FavoriteButton.tsx`, `pages/FavoriteRecipesPage.tsx` |
| UC25 | Lưu bài / theo dõi thành viên | UI ONLY | Làm khác | Có lưu bài: bảng `SavedPost` + API, nút "Lưu" trên bài, chế độ xem "Bài đã lưu"; bài bị ẩn/chờ duyệt/xóa tự biến mất. **Không làm** theo dõi thành viên (ngoài trọng tâm đề tài, `docs/han-che.md`) | `backend/src/modules/community/community.service.ts` (`setPostSaved`, `listSavedPosts`), `frontend/src/pages/CommunityPage.tsx`, `components/community/PostCard.tsx` |
| UC26 | Chia sẻ bài viết qua trình duyệt | UI ONLY | Đã làm | Giữ nguyên theo quyết định: Web Share API, không có thì sao chép | `frontend/src/features/community/community.logic.ts` (`shareCommunityPost`) |

Tổng: Đã làm 15, Làm khác 11, Chưa làm 0 (phần "theo dõi thành viên" của UC25 không làm, có ghi lý do).

## 2. Use case mới ngoài khảo sát

Mẫu giống mục 12 `REPORT_NOURI.md`. Mọi thao tác của Người dùng chỉ đọc/ghi dữ liệu của chính họ (`userId` lấy từ JWT).

### UC27 — Nhận gợi ý món (3 thuật toán)

- Tác nhân chính: Người dùng.
- Tiền điều kiện: đã đăng nhập; có bộ món trong thư viện.
- Luồng chính: (1) mở Tổng quan / Kho / chi tiết món / Công thức; (2) giao diện gọi `GET /api/recommendations` với ngữ cảnh (`today`, `for-you`, `pantry`, `similar`, `also-cooked`); (3) backend lọc an toàn trước (dị ứng, món không thích, chay/thuần chay, món ẩn, đúng bữa — `safety.ts`); (4) chấm điểm lai: dựa trên nội dung (thuật toán 1), cộng tác item–item (thuật toán 2), dựa trên tri thức theo ngữ cảnh (thuật toán 3) và thành phần phổ biến; (5) đa dạng hóa MMR; (6) trả món kèm lý do.
- Luồng phụ: người dùng mới chưa có tương tác → `coldStart`, trọng số chuyển sang tri thức + phổ biến; "Người khác cũng nấu" chỉ hiện khi ≥ 3 người khác.
- Bằng chứng: `backend/src/modules/recommendation/` (`hybrid.ts`, `content-based.ts`, `collaborative.ts`, `knowledge-based.ts`, `safety.ts`), `docs/thuat-toan-goi-y.md`, ma trận an toàn `backend/src/test/dietary-matrix.test.ts`.

### UC28 — Tự cập nhật kho khi ăn và khi mua

- Tác nhân chính: Người dùng.
- Tiền điều kiện: có thực đơn; kho có thực phẩm trùng tên nguyên liệu (khớp bỏ dấu cách/hoa thường).
- Luồng chính (đã ăn): (1) bấm "Đã ăn" ở một bữa; (2) hộp xem trước liệt kê nguyên liệu → thực phẩm sẽ bị trừ (`GET /items/:id/consumption-preview`); (3) xác nhận; (4) backend trừ kho trong một transaction, ghi lịch sử `CONSUMPTION`, có điều kiện chống ghi đè đồng thời.
- Luồng chính (đã mua): (1) tick một dòng đi chợ; (2) backend nhập kho: gộp vào thực phẩm cùng tên/đơn vị quy đổi được, dùng lại món "Đã dùng hết", hoặc tạo mới với hạn ước tính theo nhóm.
- Luồng phụ: bỏ đánh dấu → hoàn lại đúng lượng đã trừ/nhập (không hoàn hai lần); đồ đã hết hạn mặc định không bị trừ; thực phẩm về 0 được giữ lại ("Đã dùng hết").
- Bằng chứng: `meal-consumption.service.ts`, `pantry-intake.ts`, `services/pantry-consumption.ts`, `services/pantry-purchase.ts`, `services/pantry-match.ts`.

### UC29 — Quét hóa đơn để nhập kho

- Tác nhân chính: Người dùng. Tác nhân phụ: OpenAI (đọc ảnh), Tesseract (chạy trên máy chủ).
- Tiền điều kiện: còn lượt quét hôm nay (`RECEIPT_SCAN_DAILY_LIMIT`, mặc định 10); ảnh jpg/png/webp ≤ 5 MB.
- Luồng chính: (1) Kho → "Quét hóa đơn", chụp/chọn ảnh (thu nhỏ ≤ 2000 px ở trình duyệt); (2) chọn chế độ Tự động / Đọc bằng AI / Chế độ dự phòng; (3) backend xóa EXIF, đọc nền, có tiến trình; (4) bộ phân tích bỏ dòng tổng tiền/VAT/túi…, chuẩn hóa tên theo kho và bộ món, đơn vị, nhóm, hạn ước tính; (5) màn duyệt bắt buộc: sửa/bỏ từng dòng; (6) lưu một lô trong một transaction (lịch sử nguồn `RECEIPT_SCAN`, đơn giá nếu có thành tiền).
- Luồng phụ: "Tự động" mà OpenAI lỗi/hết giờ → đọc lại bằng Tesseract và màn duyệt báo lý do; "Hủy" khi đang đọc; "Hoàn tác hóa đơn" trừ lại cả lô. Ảnh không được lưu.
- Bằng chứng: `backend/src/modules/receipt-scan/`, `backend/src/services/receipt/`, `frontend/src/components/pantry/Receipt*.tsx`, `docs/ke-hoach-gd3c.md`.

### UC30 — Xem báo cáo lãng phí và dinh dưỡng

- Tác nhân chính: Người dùng.
- Tiền điều kiện: có lịch sử kho (xóa có lý do, đã ăn) hoặc bữa "Đã ăn".
- Luồng chính: (1) mở "Báo cáo"; (2) phần lãng phí: chọn 4/8 tuần → số món bỏ đi, lượng theo nhóm, tiền lãng phí ước tính trên các món có giá, tỉ lệ dùng trước hạn, nhóm hay bỏ nhất, so với tuần trước; (3) phần dinh dưỡng: chọn tuần này/tuần trước → calo, đạm, tinh bột, béo theo ngày so với mục tiêu, trung bình tuần.
- Luồng phụ: chưa có dữ liệu → "Chưa đủ dữ liệu"; ngày chưa ghi bữa → "chưa ghi" (không tính 0); "Nhập nhầm" không tính.
- Bằng chứng: `backend/src/modules/reports/` (`reports.logic.ts`), `frontend/src/pages/ReportsPage.tsx`, `components/reports/`.

### UC31 — Nhận email nhắc đồ sắp hết hạn

- Tác nhân chính: Bộ lập lịch. Tác nhân phụ: SMTP, Người dùng.
- Tiền điều kiện: người dùng bật nhắc trong Hồ sơ (mặc định tắt), chọn báo trước 1/2/3 ngày; máy chủ có SMTP.
- Luồng chính: (1) mỗi ngày lúc `EXPIRY_EMAIL_TIME` (mặc định 07:00 giờ VN) bộ lập lịch chạy; (2) với mỗi người đã bật: chọn món còn 0..N ngày, bỏ món đã nhắc trừ khi còn đúng 1 ngày; (3) giữ khóa trong DB (một email/người/ngày); (4) gửi email: danh sách món, 3 món nên nấu (gợi ý ngữ cảnh kho), nút "Mở kho", liên kết "Tắt nhắc".
- Luồng phụ: "Gửi thử ngay" (3 lần/ngày); "Tắt nhắc" một chạm không cần đăng nhập (token HMAC); tài khoản khóa / chưa có SMTP → bỏ qua và ghi log; gửi lỗi → bỏ khóa.
- Bằng chứng: `backend/src/modules/notifications/expiry-email*.ts`, `frontend/src/pages/UnsubscribeExpiryPage.tsx`.

### UC32 — Quên và đặt lại mật khẩu

- Tác nhân chính: Khách. Tác nhân phụ: SMTP.
- Tiền điều kiện: không.
- Luồng chính: (1) "Quên mật khẩu?" ở trang đăng nhập; (2) nhập email → luôn cùng một câu trả lời; (3) nếu có tài khoản (không khóa): tạo token 32 byte, lưu SHA-256, hết hạn 30 phút, xóa token cũ, gửi email nền; (4) mở liên kết → đặt mật khẩu mới (8–72 ký tự); (5) đổi mật khẩu, thu hồi mọi refresh token, gửi email báo đổi.
- Luồng phụ: token sai/đã dùng/hết hạn → 400; tài khoản khóa → 403; 5 yêu cầu/giờ/email và /IP → 429.
- Bằng chứng: `backend/src/modules/auth/password-reset.service.ts`, `services/email.service.ts`, `frontend/src/pages/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `docs/test-evidence/bao-mat.md` mục 6.

### UC33 — Đổi mật khẩu khi đang đăng nhập

- Tác nhân chính: Người dùng.
- Luồng chính: (1) Hồ sơ → Đổi mật khẩu; (2) nhập mật khẩu hiện tại và mới; (3) backend kiểm mật khẩu cũ, đổi, ghi `passwordChangedAt` (access token cũ bị chặn ngay), thu hồi mọi refresh token, mở phiên mới cho thiết bị này, gửi email báo đổi.
- Luồng phụ: sai mật khẩu hiện tại → 400.
- Bằng chứng: `auth.service.ts` (`changePassword`), `middleware/auth.ts`.

### UC34 — Chia sẻ công thức tự viết

- Tác nhân chính: Người dùng.
- Luồng chính: (1) khi đăng bài chọn "Tự viết công thức": tên, khẩu phần, phút, nguyên liệu, các bước; (2) lưu JSON trong bài (không tạo món trong thư viện, không vào thực đơn/gợi ý/kho); (3) người xem thấy thẻ "Công thức của thành viên" kèm cảnh báo dị ứng theo hồ sơ của họ; (4) tác giả sửa/xóa bài.
- Luồng phụ: không đồng thời gắn món có sẵn và công thức tự viết; Admin có thể "Chuyển thành công thức" (UC37).
- Bằng chứng: `backend/src/modules/community/community-member-recipe.ts`, `community-post-edit.service.ts`, `frontend/src/components/community/MemberRecipe*.tsx`.

### UC35 — AI kiểm duyệt bài cộng đồng

- Tác nhân chính: OpenAI (Moderation API + model mini). Tác nhân phụ: Admin.
- Tiền điều kiện: có `OPENAI_API_KEY`.
- Luồng chính: (1) khi đăng/sửa bài, gọi song song Moderation (chữ + ảnh) và kiểm tra "có liên quan ăn uống", hạn chung 8 giây; (2) sạch → đăng ngay; nghi vấn → "chờ duyệt", chỉ tác giả thấy ("Bài đang chờ duyệt"), lưu lý do AI; (3) Admin lọc "AI đánh dấu", Duyệt hoặc Ẩn (ghi nhật ký).
- Luồng phụ: không key / lỗi / quá giờ → đăng như thường. AI không bao giờ xóa bài.
- Bằng chứng: `community-ai-review.ts`, `community-post-edit.service.ts` (`reviewFlaggedPost`), `frontend/src/pages/admin/AdminModerationPage.tsx`.

### UC36 — Admin quản lý công thức

- Tác nhân chính: Admin. Tác nhân phụ: Cloudinary.
- Luồng chính: (1) khu `/admin` → Công thức; (2) tìm, lọc hiện/ẩn; (3) thêm/sửa món và nguyên liệu (kiểm nhãn chay/thuần chay theo nguyên liệu); (4) tải/thay ảnh (xóa EXIF, ảnh cũ xóa sau khi lưu DB); (5) ẩn/hiện; (6) xóa món chưa được dùng. Mọi thao tác ghi `AdminAuditLog` cùng transaction.
- Luồng phụ: món đã có trong thực đơn/bài viết chỉ ẩn được, không xóa.
- Bằng chứng: `backend/src/modules/admin/admin-recipes.*`, `backend/src/modules/recipes/recipe-management.service.ts`, `frontend/src/pages/admin/AdminRecipe*Page.tsx`.

### UC37 — Admin kiểm duyệt cộng đồng và chuyển thành công thức

- Tác nhân chính: Admin. Tác nhân phụ: OpenAI.
- Luồng chính: (1) xem bài mới nhất kèm tác giả, ảnh, bình luận; (2) ẩn/hiện bài, xóa bài, xóa bình luận; (3) bài có công thức tự viết: "Chuyển thành công thức" mở form điền sẵn, AI ước tính dinh dưỡng một khẩu phần và chuẩn hóa tên nguyên liệu theo thư viện ("AI ước tính, vui lòng kiểm tra"); (4) Admin bấm "Tạo món" mới lưu, bài hiện "Đã được thêm vào thư viện".
- Luồng phụ: không key → form vẫn điền sẵn, Admin tự nhập dinh dưỡng; hai Admin chuyển cùng lúc → người sau nhận 409.
- Bằng chứng: `backend/src/modules/admin/admin-recipe-estimate.service.ts`, `backend/src/modules/ai/recipe-estimate.ts`, `frontend/src/pages/admin/AdminRecipeEditorPage.tsx`.

### UC38 — Admin quản lý người dùng, xem thống kê và nhật ký

- Tác nhân chính: Admin.
- Luồng chính: (1) danh sách người dùng, tìm theo tên/email; (2) khóa/mở khóa (khóa → thu hồi refresh token, mọi request sau trả 403); (3) thống kê tổng số và 12 tuần gần nhất (không tính tài khoản mẫu); (4) nhật ký thao tác lọc theo loại/người làm.
- Luồng phụ: không khóa chính mình hay Admin khác.
- Bằng chứng: `backend/src/modules/admin/admin-users.*`, `admin-stats.service.ts`, `admin-audit.*`, `frontend/src/pages/admin/`.

### UC39 — Chỉnh thực đơn: thêm món thủ công, đổi món vi phạm

- Tác nhân chính: Người dùng.
- Luồng chính: (1) thêm món vào ngày/bữa (kể cả ngày trống, bữa phụ) từ thực đơn hoặc từ chi tiết món; (2) xóa một bữa; (3) bữa vi phạm hồ sơ (sau khi đổi dị ứng/chế độ ăn) có nút "Đổi món": server chọn món thay qua lọc an toàn.
- Luồng phụ: danh sách đi chợ chỉ đổi theo phần của bữa đó.
- Bằng chứng: `backend/src/modules/meal-plans/meal-plan-items.service.ts` (`addMealPlanItem`, `shoppingChangesForMeal`), `meal-swap.service.ts` (`swapMealItem`).

### UC40 — Admin quản lý danh mục dữ liệu

- Tác nhân chính: Admin.
- Luồng chính: (1) khu `/admin` → Danh mục dữ liệu, chọn loại: Nhóm dị ứng / Nhóm thực phẩm / Viết tắt hóa đơn; (2) nhóm dị ứng: thêm nhóm
  (có thể thuộc nhóm cha, như Hải sản → Cá), đổi tên, thêm tên gọi khác, thêm nguyên liệu thuộc nhóm với mức "Chứa" hoặc "Có thể chứa"
  và cờ chế biến/gia vị; (3) nhóm thực phẩm: thêm, đổi tên, nơi bảo quản và hạn dùng mặc định; (4) viết tắt hóa đơn: thêm (lưu dạng bỏ
  dấu), ẩn/hiện; (5) mọi mục chỉ ẩn/hiện, không xóa. Mỗi thao tác kiểm bằng Zod, ghi `AdminAuditLog` (`CATALOG_CREATE`/`CATALOG_UPDATE`)
  cùng transaction; lưu xong backend nạp lại danh mục vào bộ nhớ nên bộ lọc dị ứng, nhóm Kho, đọc hóa đơn dùng bản mới ngay.
- Luồng phụ: ẩn nhóm hoặc nguyên liệu dị ứng phải xác nhận (bộ lọc sẽ thôi nhận); đổi tên nhóm dị ứng giữ tên cũ làm tên gọi khác (hồ sơ
  cũ vẫn nhận ra); đổi tên nhóm thực phẩm đổi theo trong Kho và danh sách đi chợ; trùng tên → 409; không ẩn được nhóm thực phẩm mặc định
  ("Khác").
- Bằng chứng: `backend/src/modules/admin/admin-catalog.*`, `backend/src/services/catalog/`, `backend/prisma/catalog-data.ts`,
  `frontend/src/pages/admin/AdminCatalogPage.tsx`, test `admin-catalog.test.ts` (thêm tên gọi khác → lọc nhận ra ngay).
