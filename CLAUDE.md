# CLAUDE.md — Dự án Nouri (Đồ án tốt nghiệp)

## Bối cảnh

Nouri là ứng dụng quản lý thực phẩm trong gia đình và lập kế hoạch bữa ăn/dinh dưỡng cá nhân hóa (React + Vite / Express + Prisma + PostgreSQL / OpenAI tùy chọn).

**Nguồn sự thật:** `REPORT_NOURI.md` ở thư mục gốc (Lượt 1: mục 1–5, Lượt 2: mục 6–13). Luôn đọc file này trước khi làm việc.

## Quy tắc làm việc

1. Bám sát `REPORT_NOURI.md` và code thực tế. Không tự thêm hay suy đoán chức năng.
2. Chỗ nào không rõ, mâu thuẫn giữa report và code, hoặc cần quyết định nghiệp vụ → **hỏi lại người dùng** trước khi làm.
3. Làm **theo đúng thứ tự giai đoạn** bên dưới. Xong mỗi giai đoạn: chạy test/build, tóm tắt thay đổi, chờ người dùng xác nhận rồi mới sang giai đoạn tiếp theo.
4. Giữ đúng kiến trúc hiện có: backend `module route -> controller -> service -> Prisma`, validate bằng Zod, frontend dùng `features/*/*.api.ts` + React Query.
5. Mọi API mới phải kiểm tra quyền sở hữu dữ liệu (`userId` lấy từ JWT, không tin `userId` client gửi).
6. Thay đổi schema Prisma phải tạo migration mới, không sửa migration cũ.
7. Viết/cập nhật test cho logic mới (project đã có `*.test.ts`).
8. Không đưa secret/giá trị biến môi trường vào code hoặc commit.
9. Trả lời người dùng bằng tiếng Việt.

## Quy tắc tổ chức code

1. **Độ dài file:** component/page tối đa ~300 dòng; quá 400 dòng thì bắt buộc tách. Một dòng JSX không quá 160 ký tự. Ngoại lệ: file dữ liệu như `backend/prisma/seed-data.ts`.
2. **Nơi đặt component:** component con của một module đặt trong `frontend/src/components/<module>/` (vd. `components/pantry/PantryTable.tsx`); component dùng chung nhiều module (`States`, `DateInput`) đặt ở `components/`. Page chỉ ghép component, giữ state và gọi query/mutation.
3. **Logic thuần:** đặt trong `frontend/src/features/<module>/*.logic.ts` và có test; component chỉ hiển thị và gọi hàm/hook. Backend: logic thuật toán tách khỏi service CRUD (vd. `meal-plan-generator.ts` cạnh `meal-plans.service.ts`).
4. **CSS theo module:** toàn bộ CSS ở `frontend/src/styles/ui/` và chỉ dùng token (`tokens.css`); `base.css` là reset tối thiểu. Thứ tự import trong `styles.css` (token → base → components → shell → module) quyết định kết quả; CSS mới viết vào file của module tương ứng hoặc file mới thêm ở cuối danh sách. Không dùng `!important` (ngoại lệ duy nhất: khối giảm chuyển động trong `base.css`, có ghi lý do). Đổi CSS dùng chung thì so ảnh trước/sau.
5. **Tách component theo giai đoạn:** giai đoạn nào sửa trang nào thì **tách component của trang đó trước**, thành **một commit riêng** (không đổi hành vi/giao diện), có **so ảnh trước/sau** (máy tính + điện thoại, các trạng thái chính của trang) rồi mới làm chức năng mới. Lịch tách: Pantry (xong ở bước dọn code), Dashboard và RecipeDetail ở GĐ2c (xong), Community ở GĐ2b (xong), MealPlans ở GĐ5, Landing: viết lại hẳn ở UI-11 (component trong `components/landing/`, dữ liệu tĩnh ở `features/landing/landing.data.ts`), không còn việc tách riêng.
6. **Cấu trúc Admin (GĐ3, tách khu riêng ở UI8):** frontend `pages/admin/*Page.tsx`, `components/admin/`, `features/admin/*.api.ts`, `layouts/AdminLayout.tsx` (khung riêng, menu trái, không dùng `AppLayout`), route guard `AdminRoute`, điều hướng theo vai trò `postLoginPath`/`adminRedirect` (`features/layout/layout.logic.ts`), CSS `styles/ui/admin.css` (chỉ dùng token). Backend `modules/admin/` dùng `requireAdmin`, gọi lại service sẵn có (công thức, service xóa bài dùng chung), không chép logic.

## Các quyết định đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Admin | **Bổ sung Admin** (xem phạm vi bên dưới) |
| 2 | Phạm vi Use Case | **Đưa tất cả UC vào sơ đồ** → phải hoàn thiện UI ONLY và BACKEND ONLY; NOT IMPLEMENTED làm có chọn lọc |
| 3 | Cảnh báo pantry đếm trùng | **Gộp** vào module Notifications; Pantry chỉ giữ CRUD |
| 4 | UC09 Tạo thực đơn | Ghi **DONE**, đặc tả mô tả 2 nhánh: OpenAI và fallback rule-based |
| 5 | Logout | **Thu hồi token phía server**: access token ngắn hạn (~15 phút) + refresh token lưu DB (xong ở GĐ4) |
| 6 | Checkbox "Nhớ đăng nhập" | **Sửa**: tick → `localStorage`, không tick → `sessionStorage` |
| 7 | Link thông báo `/pantry?item=...` | **Sửa**: PantryPage đọc query `item`, cuộn tới/làm nổi bật item |
| 8 | Dữ liệu landing | **Dùng API công thức thật** → cần endpoint công khai (không `requireAuth`) cho Guest |
| 9 | Dịch vụ ngoài | **Có**: email + upload ảnh; OAuth tùy chọn; không làm payment (xem dưới) |
| 10 | Kiểu `startDate` | Theo schema: `DateTime` |
| 11 | Đăng ký xong lưu phiên ở đâu | Mặc định `localStorage`. Toàn bộ logic chọn kho lưu nằm trong `auth.storage.ts` (GĐ4 refresh token dùng lại) |
| 12 | `?item=` trỏ tới item không tồn tại | Hiện dòng nhắc "Thực phẩm này không còn trong kho". Xử lý xong `?item=` (tìm thấy hay không) thì xóa tham số khỏi URL bằng `replace` |
| 13 | Thẻ lịch sử AI | Dùng `createdAt` thật thay thời gian giả; nút "Xem tất cả" mở rộng hiện toàn bộ lịch sử đã tải (GĐ1) |
| 14 | Nút "Ảnh", "Công thức" ở form đăng bài | Ẩn tạm từ GĐ1; mỗi nút hiện lại khi chức năng tương ứng làm xong ("Công thức" ở GĐ2b, "Ảnh" ở GĐ3) |
| 16 | Phạm vi chia sẻ món ăn ở Community | Đăng bài kèm ảnh và **chọn một**: gắn công thức có sẵn, hoặc **tự viết công thức** (nhánh `giai-doan-cong-dong`, 12/11/2026): lưu JSON trong bài (`CommunityPost.memberRecipe`), **không tạo Recipe**, không vào thực đơn/gợi ý/kho; nhãn "Công thức của thành viên", cảnh báo dị ứng theo hồ sơ người xem (hàm so khớp của bộ gợi ý), "chưa được kiểm duyệt dinh dưỡng". Chỉ tác giả sửa/xóa; Admin ẩn/hiện bài và "Chuyển thành công thức" (tạo món trong thư viện, `promotedRecipeId`, nhật ký `POST_PROMOTE`) |
| 17 | Ô nhập ngày | Component dùng chung `DateInput` (dd/mm/yyyy, không phụ thuộc locale); gửi API `yyyy-MM-dd`. Trường không bắt buộc: ô trống = `null` (cho lưu), nhập sai = chặn lưu |
| 15 | Xóa bài cộng đồng | User xóa bài của mình (GĐ5) và Admin xóa bài vi phạm (GĐ3) **dùng chung service xóa**, chỉ khác điều kiện quyền |

### Phạm vi Admin

- Role: thêm `role` (USER/ADMIN) vào `User`, middleware `requireRole`/`requireAdmin`.
- Tài khoản Admin tạo bằng **seed**, không cho đăng ký công khai.
- Quản lý công thức: CRUD Recipe + RecipeIngredient, upload ảnh.
- Quản lý người dùng: xem danh sách, khóa/mở khóa (user bị khóa không đăng nhập/gọi API được, refresh token bị thu hồi).
- Kiểm duyệt cộng đồng: xóa bài viết/bình luận vi phạm.
- Thống kê đơn giản: số user, số meal plan, số bài viết (dùng Recharts đã có).

### Nhóm NOT IMPLEMENTED

| Chức năng | Quyết định |
|---|---|
| Thêm món thủ công vào thực đơn | **Làm** |
| Đăng ảnh trong bài viết | **Làm** ở GĐ3, ngay sau hạ tầng upload Cloudinary |
| Đính kèm công thức vào bài viết | **Làm** ở GĐ2b, ngay sau GĐ2 (FK `recipeId` tùy chọn, chỉ công thức có sẵn) |
| Giọng nói, đính kèm trong chat AI, poll | **Gỡ khỏi UI**, ghi vào hướng phát triển |
| Bookmark Dashboard | GĐ5: nối với favorite recipe |
| Bookmark Landing | UI-11: Landing mới không có nút bookmark; khách bấm thẻ món thì sang `/login?next=/recipes/:id` (đăng nhập xong mở đúng món) |
| "Xem tất cả" thành viên nổi bật | GĐ5 (cùng với thành viên nổi bật từ dữ liệu thật) |
| Menu "Tùy chọn bài viết" | GĐ5: chứa "Lưu bài" và "Xóa bài của tôi" |
| "Xem tất cả" lịch sử chat AI | GĐ1: mở rộng hiện toàn bộ lịch sử đã tải |

### Nhóm UI ONLY → lưu DB

| Chức năng | Quyết định |
|---|---|
| Yêu thích công thức | Model `FavoriteRecipe` + API |
| Lưu bài viết | Model `SavedPost` + API |
| Follow thành viên | Model `Follow` + API |
| Lượng nước | Lưu DB theo ngày + API |
| Chủ đề/thành viên nổi bật | Tính từ dữ liệu thật (vd. thành viên nhiều bài/like nhất) |
| Chia sẻ bài viết | **Giữ nguyên** (Browser Share API là chức năng client hợp lệ) |

### Dịch vụ ngoài

| Dịch vụ | Quyết định |
|---|---|
| Email | Quên/đặt lại mật khẩu, Nodemailer + SMTP |
| Upload ảnh | Cloudinary (ảnh công thức, ảnh bài viết) |
| OAuth Google | Tùy chọn, làm sau cùng nếu còn thời gian |
| Payment | Không làm (trừ khi đề cương bắt buộc) |

Biến môi trường mới phải thêm vào `backend/src/config/env.ts` (Zod) và `.env.example` (chỉ tên, không giá trị). Biến chỉ seed dùng khai báo trong `backend/src/config/seed-env.ts`.

## Kế hoạch thực hiện (theo thứ tự)

### Đã xong (chi tiết, số liệu kiểm thử, commit: `docs/lich-su-giai-doan.md`)
- GĐ1 — sửa lỗi nhỏ, dọn UI. GĐ2 — UI cho API đã có. GĐ2c — bộ 33 món, thuật toán thực đơn, "Dành cho bạn", khẩu phần. GĐ2b — gắn công thức vào bài viết.
- Làm lại toàn bộ giao diện UI-1 → UI-12 theo `docs/design/DESIGN.md` (gộp `main` 03/11/2026).
- GĐ3 — Admin (vai trò, khóa tài khoản, món ẩn, công thức, người dùng, kiểm duyệt, thống kê, nhật ký), Cloudinary (ảnh công thức, ảnh bài viết xóa EXIF).
- GĐ3b lượt 1–7 — gzip; lịch sử kho `PantryTransaction`; "Đã ăn" → trừ kho (hộp xem trước) và hoàn lại; 8 nhóm thực phẩm chung, "Đã dùng hết"; "Đã mua" → kho (gộp/dùng lại/tạo mới, hạn ước tính) và hoàn lại; giao diện lịch sử kho; `demo:reset`.
- GĐ3b-R: R1 (lọc an toàn + `fit` + ràng buộc AI + ma trận an toàn), R3 (thuật toán 1), R4 (thuật toán 2 + tài khoản mẫu `isSample`), R5 (thuật toán 3, bộ trộn, `GET /api/recommendations`), lịch sử mẫu demo, R6 (đánh giá mô phỏng, chốt trọng số), thành phần phổ biến (w_pop0 = 0,3), R7 (gợi ý trên giao diện).

- GĐ3c phần 1 (P1-1 backend Tesseract + parser + API quét/hoàn tác lô; P1-2 giao diện quét, màn duyệt, hoàn tác): xong, người dùng đã kiểm thử, gộp `main` 09/11/2026. Phần 2 (OpenAI Vision) chờ `OPENAI_API_KEY`.
- Codex (tuần 45, nhánh `codex-tuan-45`): C0 `AGENTS.md`, C1 đối chiếu R2, C2 thêm/xóa món thủ công (Claude sửa: đi chợ chỉ đổi theo phần của bữa, ngày trống/bữa phụ, nút ở chi tiết công thức).

**Nhánh (09/11/2026):** `main` đã đầy đủ (gộp `giai-doan-3b` gồm GĐ3, GĐ3b, R1–R7, R2, C0–C2; gộp `giai-doan-3c` gồm GĐ3c phần 1). Việc mới làm trên nhánh mới tách từ `main`; **chỉ merge (không squash) vào `main` khi test + typecheck + build đều qua VÀ tính năng đã được kiểm tra thực tế (thử trên app với dữ liệu/dịch vụ thật, không chỉ test giả lập); merge xong push rồi mới tách nhánh mới** (quy tắc 12/11/2026); Codex làm trên `codex/<tên việc>`, không tự merge, Claude rà rồi mới merge.

**Codex và `AGENTS.md`:** `AGENTS.md` là luật cho Codex, phải giữ khớp với CLAUDE.md (sửa luật ở đây thì sửa cả bên đó). Hai quy tắc chặt hơn có chủ đích cho Codex: không tạo migration, hỏi trước khi `demo:reset`.

**Việc còn lại (theo thứ tự, chốt 09/11/2026; đóng băng code 25/11):** ~~GĐ3c phần 1~~ (xong) → ~~R8~~ (xong, đã gộp main) → ~~C3 + GĐ4~~ (xong, đã gộp main) → ~~bản 8 + tách Admin + chỉnh UX~~ (giao diện người dùng làm lại + tách Admin xong trên nhánh `giai-doan-ui8`, 11/11/2026; giữ bộ màu hiện tại, không áp bảng màu "bản 8") → dự phòng sửa lỗi → GĐ3c phần 2 (cần `OPENAI_API_KEY`, 1 lượt) → R10. Song song: Codex làm C5 (script ảnh món) và C6 (tài liệu quyển: ERD, API, đối chiếu UC), chỉ sửa `docs/` và `scripts/`. C4 Cộng đồng "Dành cho bạn" (= R9): tùy chọn, chỉ làm nếu còn thời gian. C2 đã gộp, chờ người dùng kiểm thử giao diện.

### Quy tắc đã áp dụng, cần giữ khi làm tiếp
- **Giao diện:** `docs/design/DESIGN.md` là nguồn sự thật; CSS mới ở `styles/ui/` chỉ dùng token (test `features/ui/design-rules.test.ts` chặn mã màu cứng, gradient, `backdrop-filter`, emoji, "→"; thư mục component mới phải thêm vào test); thành phần dùng chung ở `components/ui/` (Dialog, ConfirmDialog/`useConfirm`, Toast, States…); không dùng `window.confirm`. Phông phải đủ tiếng Việt (kiểm dấu chồng ố ặ ữ ỗ ẫ ợ ở mọi độ đậm, nghiêng; dự phòng Noto Serif/Noto Sans). Bộ màu: giữ bộ hiện tại (người dùng chọn 11/11/2026, không áp "bản 8"); khung chung mọi trang `--content-max` (1280 / 1400 từ 1600px / 1440 từ 1920px).
- **Món bị ẩn:** "đã dùng" = có `MealPlanItem` hoặc `CommunityPost` tham chiếu → chỉ ẩn, không xóa; không hiện ở danh sách, không chọn được khi tạo thực đơn/đăng bài/gợi ý; chi tiết vẫn xem được kèm "Món này đã ngừng sử dụng"; điều kiện chung `visibleRecipeWhere`.
- **Quyền/khóa:** `requireAuth` đọc `role`, `lockedAt` từ DB mỗi request; khóa → 403 `ACCOUNT_LOCKED` (frontend đăng xuất về `/login?locked=1`); Admin không khóa chính mình/Admin khác; mọi thao tác Admin ghi `AdminAuditLog` trong cùng transaction. ADMIN dùng khu `/admin` riêng (mở trang người dùng → `/admin`, trừ `/recipes/:id`); mọi nút/hộp thoại Admin được kiểm kê trong `admin-controls.test.ts`.
- **Ảnh:** jpg/png/webp (kiểm byte đầu), ≤ 5 MB, ≤ 4 ảnh/bài, xóa EXIF bằng sharp trước khi tải; URL Cloudinary tối ưu `f_auto,q_auto,c_limit,w_…`; thay ảnh thì xóa ảnh cũ sau khi lưu DB.
- **Kho (GĐ3b):** lượng một bữa = `quantity × item.servings / recipe.servings`; khớp tên bằng `normalizeFoodText` (`pantry-match.ts`), quy đổi g↔kg, ml↔l; mọi thay đổi kho ghi `PantryTransaction` trong cùng transaction, có điều kiện chống ghi đè đồng thời và không hoàn hai lần; thực phẩm về 0 giữ lại ("Đã dùng hết"); đồ hết hạn mặc định không trừ; 8 nhóm `FOOD_CATEGORIES`; hạn gợi ý theo nhóm (`pantry-purchase.ts`, `expiryEstimated`).
- **Gợi ý (GĐ3b-R):** luôn qua `safety.ts` trước (dị ứng, không thích, chay/thuần chay, món ẩn, đúng bữa); nguồn gợi ý mới phải thêm vào `src/test/dietary-matrix.test.ts`; "có trong thực đơn" chỉ cho thuật toán 1 (tránh vòng lặp phản hồi); "Người khác cũng nấu" ≥ 3 người khác, không lộ người dùng; tài khoản mẫu `isSample` không tính vào thống kê Admin; trọng số ngữ cảnh ở `CONTEXT_WEIGHTS`, `POPULARITY_WEIGHT0` trong `hybrid.ts` (lý do chọn: `docs/thuat-toan-goi-y.md`); đánh giá lại bằng `npm run eval:recommend -w backend`, đo hiệu năng `npm run test:perf -w backend`.

### Giai đoạn 3b-R — còn lại
Kiến trúc, công thức và quyết định: `docs/thuat-toan-goi-y.md` và `docs/lich-su-giai-doan.md` (mục GĐ3b-R).
- [x] R2 — "Tất cả công thức" ẩn món vi phạm dị ứng/chế độ ăn mặc định + "Hiện tất cả" (món không thích chỉ gắn nhãn); thực đơn cũ cảnh báo bữa vi phạm + "Đổi món" (`POST /api/meal-plans/items/:id/swap`, server chọn món qua `safety.ts`); dòng nhắc dưới khung chat AI; gợi ý dinh dưỡng thực đơn tính ở backend (`meal-plan-suggestions.ts`, `overlapsFoodTerms`).
- [x] R8 — Thực đơn không có OpenAI dùng `scoredPlan` (`meal-plan-scorer.ts`): thuật toán 3 + 0,3 × thuật toán 1, kho ảo (đồ sắp hết hạn không dùng quá lượng có, chỉ các ngày trước hạn), không lặp trong 3 ngày, calo ±35% mục tiêu bữa; đánh giá `npm run eval:mealplan -w backend` (mục 9 `docs/thuat-toan-goi-y.md`). Đã kiểm thử, gộp `main` 09/11/2026.
- [ ] R9 — Cộng đồng: tab "Dành cho bạn" (backend + frontend) (trung bình). Làm dưới tên C4.
- [ ] R10 — `docs/han-che.md`, `docs/cau-hoi-bao-ve.md`, cập nhật CLAUDE.md (dễ).

### Giai đoạn 3c — Quét hóa đơn (OCR)
Kế hoạch chi tiết: `docs/ke-hoach-gd3c.md`. Phần 1 (Tesseract trên server, parser, chuẩn hóa, màn duyệt, hoàn tác lô, đánh giá) làm trước; phần 2 (OpenAI Vision) làm khi có key.
- [x] P1-1 backend: migration `ReceiptScan` + `PantryTransaction.receiptScanId`; Tesseract (`vie+eng` đóng gói sẵn) + Mock; parser/chuẩn hóa (`services/receipt/`); API `/api/pantry/receipt-scans` (status, quét nền có tiến trình, commit một lần, hoàn tác lô; `RECEIPT_SCAN_DAILY_LIMIT`); nhập/hoàn kho dùng chung với "Đã mua" (`pantry-intake.ts`); `npm run eval:receipt -w backend`.
- [x] P1-2 frontend: nút "Quét hóa đơn" ở Kho và Tổng quan (`/pantry?scan=1`), chụp/chọn ảnh (thu nhỏ ≤ 2000 px ở trình duyệt), tiến trình 3 bước có "Hủy" (`POST /:id/cancel`), màn duyệt (`components/pantry/Receipt*.tsx`, logic `features/pantry/receipt-scan.logic.ts`), dải "Hoàn tác" sau khi lưu, nút "Hoàn tác hóa đơn" trong lịch sử kho. Đã thử trong container Alpine qua API.
- [ ] Chạy `eval:receipt` khi đã có ~10 ảnh hóa đơn thật (người dùng chụp), ghi tỉ lệ đọc đúng.
- [x] Phần 2 (nhánh `giai-doan-3c-p2`, 12/11/2026): `OpenAIVisionProvider` (Responses API, structured output cùng dạng `RawReceiptItem`, ảnh JPEG đã qua sharp, timeout 60 s, không thử lại, model `OPENAI_VISION_MODEL`); 3 chế độ "Tự động" (mặc định: OpenAI, lỗi/hết giờ → tự đọc lại bằng Tesseract, màn duyệt báo lý do) / "Đọc bằng AI" / "Chế độ dự phòng"; `ReceiptScan` ghi `inputTokens`, `outputTokens`, `fallbackCode` (migration mới); `/api/ai/status` có `receiptScan`; `eval:receipt` chạy cả hai chế độ, ghi `ket-qua.md` (tỉ lệ đúng, thời gian, chi phí USD/VNĐ). Nhóm và hạn ước tính vẫn do bộ chuẩn hóa gán (như Tesseract). Màn duyệt bắt buộc, không lưu ảnh: dùng lại từ phần 1. Người dùng đã quét thật 1–2 hóa đơn; gộp `main` 12/11/2026.
- [ ] Bước Tài liệu: kiểm thử trên ~10 hóa đơn thật, ghi tỷ lệ đọc đúng.

### Giai đoạn AI (nhánh `giai-doan-ai`, gộp `main` 12/11/2026 sau 3c-p2)
- [x] Hỏi Nouri: prompt cố định (dị ứng tuyệt đối kể cả khi bị yêu cầu "bỏ qua hướng dẫn", chỉ chủ đề ăn uống/dinh dưỡng/nấu nướng/kho, câu ngoài lề từ chối + gợi ý); ngữ cảnh thêm `pantry.expiringSoon` (≤ 3 ngày) và 6 tin gần nhất (mỗi tin ≤ 600 ký tự), kho tối đa 40 thực phẩm; câu trả lời được so khớp dị ứng (`answerAllergyWarnings`) → cảnh báo trên tin; `AI_CHAT_DAILY_LIMIT` (mặc định 30) → 429; chưa có key/OpenAI lỗi → 503 (`AI_NOT_CONFIGURED`/`AI_UNAVAILABLE`), không lưu tin, khung chat gợi ý "Gợi ý cho bạn" / "Nấu gì từ kho?".
- [x] Cộng đồng — AI kiểm duyệt (`community-ai-review.ts`): Moderation API (chữ + ảnh) + model mini kiểm "có liên quan ăn uống", chạy song song, hạn chung 8 giây; nghi vấn → `pendingReviewAt` + `aiReviewReason` (chỉ tác giả thấy, "Bài đang chờ duyệt"); sửa bài cũng kiểm lại; không có key/API lỗi → đăng như thường. Admin lọc "AI đánh dấu", Duyệt (`POST_APPROVE`) / Ẩn (`POST_HIDE`), ghi nhật ký; AI không xóa bài. Migration `community_ai_review`.
- [x] "Chuyển thành công thức": `POST /api/admin/community/posts/:postId/recipe-estimate` (AI ước tính 1 khẩu phần, tên nguyên liệu chỉ nhận tên có trong thư viện), form tự điền ô còn trống, ghi "AI ước tính, vui lòng kiểm tra"; Admin bấm "Tạo món" mới lưu.
- [x] Người dùng đã thử với `OPENAI_API_KEY` thật.

### Nhắc đồ sắp hết hạn qua email (nhánh `giai-doan-nhac-han`, gộp `main` 13/11/2026)
- [x] Hồ sơ: công tắc "Nhắc đồ sắp hết hạn qua email" (`NutritionProfile.expiryEmailEnabled`, mặc định tắt; demo bật sẵn), báo trước 1/2/3 ngày (`expiryEmailDays`, mặc định 2), "Gửi thử ngay" (3 lần/ngày, `POST /api/expiry-email/test`).
- [x] Lịch: `node-cron` mỗi ngày lúc `EXPIRY_EMAIL_TIME` (mặc định 07:00, Asia/Ho_Chi_Minh), khởi động trong `server.ts`. Khóa chống gửi trùng = dòng `ExpiryEmailLog` unique (userId, ngày, slot) tạo trước khi gửi (gửi lỗi thì xóa khóa); 1 email/người/ngày; không có món thì không gửi; không nhắc lại cùng món (id + hạn) trừ khi còn đúng 1 ngày; tài khoản khóa / chưa có SMTP → bỏ qua, ghi log.
- [x] Nội dung: món sắp hết hạn (tên, số lượng, còn mấy ngày) + 3 món từ `getRecommendations(context: "pantry")` kèm lý do và liên kết, nút "Mở kho", "Tắt nhắc" một chạm (`/tat-nhac-han`, token HMAC riêng, tắt bằng JS khi trang mở để trình quét liên kết không tự tắt).
- [x] `DEMO_EMAIL_INBOX`: thư gửi demo@nouri.vn chuyển tới hộp thư thật (tiêu đề ghi "[Demo …]"), chỉ tài khoản demo. Gộp `main` 13/11/2026.

### Báo cáo (nhánh `giai-doan-bao-cao`, gộp `main` 13/11/2026)
- [x] Xóa khỏi kho bắt buộc chọn lý do (`DELETE /api/pantry/:id?reason=USED_UP|DISCARDED|MISTAKE`), lưu `PantryTransaction.removalReason`; lịch sử kho chụp lại `category`, `expiryDate`, `unitPrice` lúc thay đổi. "Nhập nhầm" không tính.
- [x] Đơn giá tùy chọn `PantryItem.unitPrice` (đ / đơn vị): nhập tay trong form Kho; quét hóa đơn có thành tiền → `price / quantity`.
- [x] `/reports` (menu "Báo cáo", Recharts tải lazy): lãng phí 4/8 tuần (`GET /api/reports/waste`): món bỏ đi, lượng theo nhóm (g/ml/cái), tiền lãng phí "ước tính trên N món có giá", tỉ lệ dùng trước hạn = dùng trước hạn / (dùng + bỏ đi), nhóm hay bỏ nhất, so với tuần trước. "Dùng" = trừ kho khi ăn, sửa về 0, xóa "Đã dùng hết" khi còn hàng. Dinh dưỡng tuần (`GET /api/reports/nutrition?week=current|previous`) từ bữa "Đã ăn": ngày chưa ghi = "chưa ghi" (không tính 0), trung bình chỉ trên ngày đã ghi. Tuần: Thứ Hai 00:00 giờ VN (`reports.logic.ts`).
- [x] `demo:reset`: 8 tuần lịch sử kho mẫu (bỏ đi giảm dần, dùng trước hạn tăng dần, một phần có giá) + thực đơn mẫu 6 ngày qua có bữa "Đã ăn" (bỏ trống 1 ngày) — `prisma/demo-report.ts`.
- [x] Menu 7 mục: đo bằng Playwright 1201–1440px, tên tài khoản dài làm trang tràn 48px ở 1201px → rút nhãn "Kho thực phẩm" thành "Kho" trên menu; gộp `main` 13/11/2026.

### Giai đoạn 4 — Bảo mật tài khoản
- [x] Access token 15 phút + refresh token (cookie httpOnly, `SameSite=Strict`, `Path=/api/auth`; DB lưu SHA-256, bảng `RefreshToken`), xoay vòng, dùng lại token cũ → thu hồi cả chuỗi (trừ 10 giây cho hai tab, `REFRESH_RACE`); thu hồi khi đăng xuất, Admin khóa, đổi mật khẩu (`POST /api/auth/change-password`, `passwordChangedAt` chặn access token cũ); frontend tự làm mới một lần khi 401. Kèm C3: rate limit 20/phút/IP cho login/register, body JSON ≤ 100 KB, lỗi JSON 400/413. Chi tiết, việc còn lại: `docs/test-evidence/bao-mat.md`.
- [x] Quên/đặt lại mật khẩu qua email (nhánh `giai-doan-email`, 13/11/2026, đổi quyết định 10/11): Nodemailer + SMTP (`SMTP_*`, `MAIL_FROM`; chưa cấu hình thì ghi log, `/api/health` báo), token 32 byte lưu SHA-256, 30 phút, một lần, yêu cầu mới xóa token cũ; 5/giờ/email và 5/giờ/IP; đổi xong thu hồi mọi refresh token + email báo đổi (cả khi đổi trong Hồ sơ); tài khoản khóa không đặt lại được. Gộp `main` 13/11/2026. Chi tiết: `docs/test-evidence/bao-mat.md` mục 6.
- [x] `npm audit fix` (không `--force`): 18 → 9. Còn 9 cần nâng bản lớn (prisma 7, zod 4, openai 7, sharp 0.35, vitest 5): **không nâng** (quyết định 10/11), ghi rủi ro ở `docs/han-che.md` mục 1.1. Docker: cổng backend chỉ nghe `127.0.0.1:4000`.

### Giai đoạn 5 — Nghiệp vụ bổ sung
- [x] ~~Tách dữ liệu tĩnh của Landing ra `features/landing/landing.data.ts`~~: làm trong UI-11 (Landing viết lại). (`MealPlansPage` đã tách vào `components/meal-plans/` khi làm lại giao diện ở UI-6.)
- [x] Thêm món thủ công vào thực đơn (C2): `POST /api/meal-plans/:id/items`, `DELETE /api/meal-plans/items/:id`; đi chợ chỉ đổi theo phần của bữa (`shoppingChangesForMeal`, dùng chung với "Đổi món"); thêm vào ngày trống/bữa phụ; nút "Thêm vào thực đơn" ở chi tiết công thức.
- [ ] Lưu DB: favorite recipe, saved post, follow, lượng nước. (UI-7 đã gỡ nút "Lưu" bài và "Theo dõi" chỉ có state cục bộ; làm lại kèm API ở đây.)
- [ ] Chủ đề/thành viên nổi bật từ dữ liệu thật. (UI-7 đã gỡ bản dữ liệu giả ở cột phải Cộng đồng.)
- [ ] Xóa bài của tôi:
  - Endpoint `DELETE /api/community/:postId`.
  - Chỉ tác giả được xóa (so `authorId` với `userId` từ JWT); bài của người khác hoặc không tồn tại trả 404 (không lộ sự tồn tại).
  - Like/comment tự xóa nhờ `onDelete: Cascade` trong schema. `Notification` **không có FK** tới post (chỉ `relatedId` dạng chuỗi) → phải `deleteMany` notification `COMMUNITY_*` có `relatedId = postId` trong cùng transaction.
  - Service xóa dùng chung với Admin (GĐ3), tham số hóa điều kiện quyền.
  - FE: menu "Tùy chọn bài viết" chỉ hiện "Xóa bài" với bài của chính mình; có hộp xác nhận trước khi xóa.
  - Test ownership (xóa bài người khác bị từ chối, bài vẫn còn) và test xóa kèm notification.
- [ ] Menu "Tùy chọn bài viết": "Lưu bài" (SavedPost) + "Xóa bài của tôi".
- [ ] Bookmark Dashboard nối favorite recipe; "Xem tất cả" thành viên nổi bật. (Bookmark Landing: Landing mới không có bookmark, khách bấm món thì sang đăng nhập — UI-11.)
- [x] Endpoint công thức công khai cho Landing; Landing dùng API thật — **đã làm xong trong UI-11** (`GET /api/recipes/featured` + `/stats`).
  - Đã làm trước (nhánh `fix-landing-tieng-viet`): `GET /api/recipes/stats` công khai, chỉ trả số đếm (tổng, bữa sáng, món chay, thuần chay, ít tinh bột, giàu đạm); Landing hiện số thật theo nhóm, chưa tải được thì ẩn số; bỏ nhóm giả "Giảm cân", "Eat clean" và câu "Hàng ngàn công thức".
  - (Trước UI-11) carousel 4 món vẫn là dữ liệu tĩnh (đã khớp tên, thời gian, ảnh nhóm món với seed; ảnh qua `recipeImageSrc`); bấm nhóm chỉ đổi món nổi bật, chưa lọc món thật; số minh họa ở mục Cộng đồng ("2.340 thành viên", "20K+/5K+/15K+", "128" lượt thích) đã bỏ, thay bằng chữ; khi có số thật (GĐ5) có thể hiện lại.
- [ ] Gộp cảnh báo pantry về module Notifications (về mặt tổ chức code/tài liệu).

### Việc làm sau (chưa xếp giai đoạn)
- [x] Gom logic so khớp nguyên liệu/dị ứng của `mealPlanSuggestions` về backend: xong ở R2 (`GET /api/meal-plans` trả `suggestions`).
- [ ] Ô chọn công thức khi đăng bài đang lọc ở frontend trên toàn bộ danh sách công thức; khi Admin thêm nhiều món thì chuyển sang tìm kiếm ở backend (có giới hạn số kết quả).
- [x] Thay `window.confirm` bằng hộp xác nhận dùng chung (`useConfirm()`): xong ở mọi trang (không còn `window.confirm`).
- [x] Bật nén gzip ở nginx frontend: xong ở GĐ3b lượt 1 (chỉ gzip theo quyết định; brotli không làm).
- [ ] 5 ảnh `public/assets/*.jpg` giao diện không còn hiển thị nhưng `seed-data.ts` vẫn ghi vào `Recipe.imageUrl`; muốn gỡ thì đổi seed (`imageUrl: null`) và dữ liệu đang có.

### Giai đoạn 6 — Tùy chọn
- [ ] Đăng nhập Google (OAuth).
- [x] ~~Tách toàn bộ `LandingPage` (1.612 dòng)~~: thay bằng việc viết lại ở UI-11 (`components/landing/`, không còn GSAP). Kế hoạch cũ: section vào `components/landing/` (`LandingHero`, `LandingFeatures`, `LandingRecipeCarousel`, `LandingPlanSection`, `LandingCommunity`, `LandingAbout`, `LandingFooter`), hook GSAP vào `features/landing/useLanding*.ts`; so ảnh trước/sau.

### Cuối cùng — Tài liệu
- [ ] Cập nhật `REPORT_NOURI.md`: bảng chức năng, thống kê, Use Case, ERD theo code mới.
- [ ] Ghi các chức năng đã gỡ vào "Hướng phát triển".
- [ ] Sửa lỗi định dạng bảng mục 6.2, 6.8, 6.10 (tiêu đề 9 cột nhưng dòng phân cách chỉ 8 cột).
- [ ] Mục 3: bổ sung route `*` (redirect về `/`) vào danh sách route.
- [x] ~~Hướng phát triển: người dùng tự tạo công thức riêng để chia sẻ~~: đã làm dạng công thức tự viết trong bài cộng đồng (quyết định #16); hạn chế: cảnh báo dị ứng chỉ theo tên nguyên liệu, công thức tự viết chưa kiểm duyệt dinh dưỡng.
- [ ] Hạn chế: dinh dưỡng của bộ món seed là **số liệu ước tính**, tham khảo *Bảng thành phần thực phẩm Việt Nam* (Viện Dinh dưỡng, NXB Y học, 2007).
- [ ] Hạn chế: so khớp dị ứng dựa trên tên nguyên liệu và bảng nhóm dị ứng cố định; nguyên liệu có thành phần ẩn (vd. nước tương có lúa mì) có thể không bị phát hiện.
- [ ] Hạn chế: ngày từ server (hạn sử dụng, ngày thực đơn) hiển thị theo múi giờ máy người dùng; ở múi giờ âm (vd. châu Mỹ) có thể lệch về ngày hôm trước.
- [ ] Hạn chế: Admin sửa một món đã có trong thực đơn cũ thì thực đơn cũ giữ calo đã lưu ở `MealPlanItem`, nhưng tên, ảnh và nguyên liệu hiển thị theo bản đã sửa.
- [ ] Hạn chế: kiểm tra nhãn chay/thuần chay dựa trên tên nguyên liệu và bộ từ khóa cố định (`dietary.service.ts`).
- [ ] Hạn chế: ảnh đã xóa (xóa bài, thay ảnh công thức) vẫn mở được qua link cũ khoảng 1 phút do bộ nhớ đệm CDN của Cloudinary, dù đã gọi xóa kèm `invalidate: true` (đã ghi ở `docs/test-evidence/README.md`).

## Lưu ý khi demo
- **Quy tắc `demo:reset` khi làm các lượt:** chỉ chạy ở **cuối** lượt (không chạy ở đầu). Trước khi chạy, kiểm tra demo: nếu đang có dữ liệu **không do lượt hiện tại tạo** (thực đơn, bài viết, bình luận, tin nhắn…) thì báo người dùng và **chờ xác nhận** rồi mới reset.
- **Chạy trước buổi demo:** `docker compose exec backend npm run demo:reset -- --yes` (máy dev: `npm run demo:reset:dev -w backend -- --yes`). Chỉ tác động `demo@nouri.vn`: xóa thực đơn, bài viết (kèm ảnh Cloudinary), bình luận, lượt thích, tin nhắn, lịch sử kho, thông báo, kho; tạo lại hồ sơ mẫu và kho mẫu 8 thực phẩm với hạn tính từ ngày chạy theo giờ Việt Nam (Đậu hũ còn 1 ngày, Ức gà 2 ngày, các món khác 5–10 ngày, Gạo 90 ngày; Trứng dưới mức tối thiểu); mở khóa, đặt lại tên/mật khẩu demo. Giữ nguyên 33 món, Admin, nhật ký Admin. Tạo lại 8 tài khoản mẫu minh họa (`mauN@nouri.vn`, xem GĐ3b-R4). Không có `--yes` thì hỏi xác nhận, không có terminal thì dừng. Bật sẵn nhắc hạn qua email (báo trước 2 ngày) và xóa nhật ký email nhắc hạn của demo. Tạo dữ liệu mẫu 8 tuần cho trang Báo cáo (`demo-report.ts`). Mã: `backend/prisma/demo-account.ts` (dùng chung với seed: seed chỉ tạo kho mẫu khi kho demo trống), lệnh `backend/prisma/demo-reset.ts`, test `demo-account.test.ts`.
- **Bắt buộc trước demo: upload ảnh thật cho 33 món** (Admin → ảnh công thức, Cloudinary). Chưa có ảnh thì mọi nơi hiện ô tên món, hero Tổng quan không có ảnh.
- Phải có `OPENAI_API_KEY` hợp lệ, nếu không meal plan/chat chạy fallback (không phải AI thật).
- Chuẩn bị tài khoản Admin và User mẫu bằng seed.
- Khi đã có `OPENAI_API_KEY`, phải **kiểm thử lại luồng AI** (kịch bản 2–5 trong `docs/test-evidence/README.md`: thực đơn ăn chay, thuần chay, dị ứng hải sản, 4 bữa/ngày) vì các lần thử hiện tại chạy nhánh fallback; kiểm tra thêm `reconcileAIPlan` có phải thay món nào không.

## Còn chờ người dùng xác nhận
- Hạn nộp/ngày bảo vệ (để cắt bớt từ giai đoạn 6 ngược lên nếu gấp).
- Đề cương có ghi cụ thể dịch vụ ngoài nào không (email, upload, OAuth, payment).
