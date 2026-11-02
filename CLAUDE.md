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
4. **CSS theo module:** giao diện mới (từ UI-1) viết ở `frontend/src/styles/ui/` và chỉ dùng token, xem "Làm lại toàn bộ giao diện". CSS cũ: `frontend/src/styles/NN-<module>.css` là các lớp giao diện tích lũy theo thời gian, **thứ tự import trong `styles.css` quyết định kết quả**. CSS mới viết vào file của module tương ứng hoặc file mới thêm ở **cuối** danh sách import; không thêm vào `01-base.css`. Không đổi thứ tự import hay gộp selector trùng nếu chưa so ảnh trước/sau.
5. **Tách component theo giai đoạn:** giai đoạn nào sửa trang nào thì **tách component của trang đó trước**, thành **một commit riêng** (không đổi hành vi/giao diện), có **so ảnh trước/sau** (máy tính + điện thoại, các trạng thái chính của trang) rồi mới làm chức năng mới. Lịch tách: Pantry (xong ở bước dọn code), Dashboard và RecipeDetail ở GĐ2c (xong), Community ở GĐ2b (xong), MealPlans ở GĐ5, Landing: viết lại hẳn ở UI-11 (component trong `components/landing/`, dữ liệu tĩnh ở `features/landing/landing.data.ts`), không còn việc tách riêng.
6. **Cấu trúc Admin (GĐ3):** frontend `pages/admin/*Page.tsx`, `components/admin/`, `features/admin/*.api.ts`, `layouts/AdminLayout.tsx`, route guard `AdminRoute`, CSS `styles/ui/admin.css` (chỉ dùng token). Backend `modules/admin/` dùng `requireAdmin`, gọi lại service sẵn có (công thức, service xóa bài dùng chung), không chép logic.

## Các quyết định đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Admin | **Bổ sung Admin** (xem phạm vi bên dưới) |
| 2 | Phạm vi Use Case | **Đưa tất cả UC vào sơ đồ** → phải hoàn thiện UI ONLY và BACKEND ONLY; NOT IMPLEMENTED làm có chọn lọc |
| 3 | Cảnh báo pantry đếm trùng | **Gộp** vào module Notifications; Pantry chỉ giữ CRUD |
| 4 | UC09 Tạo thực đơn | Ghi **DONE**, đặc tả mô tả 2 nhánh: OpenAI và fallback rule-based |
| 5 | Logout | **Thu hồi token phía server**: access token ngắn hạn (~15 phút) + refresh token lưu DB |
| 6 | Checkbox "Nhớ đăng nhập" | **Sửa**: tick → `localStorage`, không tick → `sessionStorage` |
| 7 | Link thông báo `/pantry?item=...` | **Sửa**: PantryPage đọc query `item`, cuộn tới/làm nổi bật item |
| 8 | Dữ liệu landing | **Dùng API công thức thật** → cần endpoint công khai (không `requireAuth`) cho Guest |
| 9 | Dịch vụ ngoài | **Có**: email + upload ảnh; OAuth tùy chọn; không làm payment (xem dưới) |
| 10 | Kiểu `startDate` | Theo schema: `DateTime` |
| 11 | Đăng ký xong lưu phiên ở đâu | Mặc định `localStorage`. Toàn bộ logic chọn kho lưu nằm trong `auth.storage.ts` (GĐ4 refresh token dùng lại) |
| 12 | `?item=` trỏ tới item không tồn tại | Hiện dòng nhắc "Thực phẩm này không còn trong kho". Xử lý xong `?item=` (tìm thấy hay không) thì xóa tham số khỏi URL bằng `replace` |
| 13 | Thẻ lịch sử AI | Dùng `createdAt` thật thay thời gian giả; nút "Xem tất cả" mở rộng hiện toàn bộ lịch sử đã tải (GĐ1) |
| 14 | Nút "Ảnh", "Công thức" ở form đăng bài | Ẩn tạm từ GĐ1; mỗi nút hiện lại khi chức năng tương ứng làm xong ("Công thức" ở GĐ2b, "Ảnh" ở GĐ3) |
| 16 | Phạm vi chia sẻ món ăn ở Community | Đăng bài kèm ảnh và gắn **công thức có sẵn** trong hệ thống. Người dùng tự tạo công thức riêng → hướng phát triển |
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

### Giai đoạn 1 — Sửa lỗi nhỏ, dọn UI
- [x] "Nhớ đăng nhập": `localStorage` / `sessionStorage` theo checkbox (`LoginPage.tsx`, `AuthContext.tsx`, `auth.storage.ts`, `auth.session.ts`, `api/client.ts`); ghi nhớ lựa chọn lần trước, lần đầu mặc định tick.
- [x] PantryPage đọc `?item=` từ notification `actionUrl` và làm nổi bật item.
- [x] Gỡ nút giọng nói, đính kèm chat (`AiAssistantPage.tsx`) và poll (`CommunityPage.tsx`).
- [x] Ẩn tạm nút "Ảnh", "Công thức" trong form đăng bài.
- [x] Thẻ lịch sử AI: `createdAt` thật thay thời gian giả; "Xem tất cả" mở rộng toàn bộ lịch sử đã tải.
- [x] Ô nhập ngày dd/mm/yyyy dùng chung (`components/DateInput.tsx`, `utils/date.ts`).

Đã gộp vào `main`.

### Giai đoạn 2 — UI cho API đã có
- [x] Trang chi tiết công thức `/recipes/:id` (dùng `GET /api/recipes/:id`). Link tới từ: thẻ công thức (Recipes), tên món trong thực đơn, công thức gợi ý ở Dashboard (chỉ dữ liệu thật, không gắn cho công thức mẫu dự phòng).
  - Để sẵn chỗ trong bố cục cho nút "Thêm vào thực đơn" (làm ở GĐ5), chưa làm chức năng.
- [x] Thêm `imageUrl` vào kiểu `Recipe` (FE) + hàm chọn ảnh: `imageUrl` nếu có, ngược lại ảnh local theo tên.
- [x] Chi tiết thực đơn: route `/meal-plans/:id` trên cùng `MealPlansPage` (plan đang chọn lấy từ URL, tải bằng `GET /api/meal-plans/:id`); `/meal-plans` không id → thực đơn mới nhất; 404 → báo ngắn và về thực đơn mới nhất.
- [x] Nút xóa thực đơn có xác nhận (dùng `DELETE /api/meal-plans/:id`).

Đã thử trên trình duyệt. Commit `27eeb95` trên nhánh `giai-doan-2` (chưa gộp `main`).

### Giai đoạn 2c — Bộ món mới, logic tạo thực đơn, trang chi tiết công thức
Thứ tự: (b) → khảo sát dọn code → (a), (c), (d).
- [x] (b) Thay toàn bộ bộ món seed và sửa logic tạo thực đơn:
  - Bộ 33 món (~80% Việt Nam, ~20% nước ngoài), đủ bữa sáng/trưa/tối/phụ và đủ món cho từng `DietType`; dữ liệu seed tách riêng `prisma/seed-data.ts`.
  - Mỗi món 4–7 bước chi tiết, nguyên liệu khớp bước làm, đơn vị thuộc `FoodUnit`, tên nguyên liệu tiếng Việt thông dụng; tránh tên nhập nhằng ("Quả bơ", "Bơ lạt", không dùng "Bơ").
  - `cuisine` thống nhất: "Việt Nam", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Ý", "Hy Lạp", "Mỹ".
  - Ảnh tạm theo 5 nhóm (ngũ cốc/sáng, cá & hải sản, món chay, thịt & gà, đồ uống/tráng miệng) lưu ở `imageUrl`; GĐ3 Admin upload ảnh thật.
  - Schema: `Recipe.mealTypes MealType[]` + migration mới. `fallbackPlan` chọn món theo bữa và theo `mealsPerDay`.
  - Chế độ ăn: VEGETARIAN/VEGAN lọc bắt buộc; LOW_CARB/HIGH_PROTEIN chỉ ưu tiên; BALANCED không lọc. Danh sách gửi OpenAI lọc như vậy.
  - Dị ứng theo nhóm (bảng ánh xạ ở backend: Hải sản, Sữa, Trứng, Đậu phộng, Gluten), so khớp không phân biệt hoa thường/khoảng trắng.
  - Test: 140 tổ hợp (5 chế độ ăn × 7 bộ dị ứng × 3–4 bữa × kho trống/kho demo) vẫn có thực đơn 7 ngày hợp lệ; kiểm tra dữ liệu seed.
  - Giảm lặp món (quy tắc ưu tiên, không bắt buộc): tránh món bữa tối hôm trước ở bữa sáng/trưa hôm sau, phân bổ đều số lần mỗi món trong tuần; "không lặp trong cùng ngày" giữ nguyên. Áp dụng cho `fallbackPlan` và phần thay món của `reconcileAIPlan`.
  - Kiểm tra kết quả OpenAI (`reconcileAIPlan`): món ngoài danh sách đã lọc, sai bữa theo `mealTypes`, lặp trong ngày hoặc bữa bị thiếu → thay bằng món chọn theo logic fallback; thiếu ngày hoặc quá 50% bữa vi phạm → dùng `fallbackPlan` cho cả thực đơn. `aiGenerated` phản ánh nguồn thực tế (false khi phải dùng fallback).
  - Landing: đổi tên 4 món hardcode theo bộ mới (API thật vẫn để GĐ5). Dashboard: 3 món dự phòng lấy từ bộ mới.
  - Kèm theo: chỉ tiêu seed tính bằng `calculateNutritionTargets`; gợi ý trang Thực đơn theo hồ sơ; ảnh món theo công thức; sửa xóa thực đơn cuối; Docker build bằng lockfile (`npm ci`).
  - Đã kiểm thử trên trình duyệt (`docs/test-evidence/`) và gộp vào `main`.
- [x] Khảo sát dọn code sau (b) — nhánh `don-code`, đã gộp vào `main`:
  - Nhãn trung thực "Tạo bởi AI" / "Thuật toán gợi ý" (`GET /api/ai/status` chỉ trả `available`).
  - `docker-compose.yml` đọc `POSTGRES_PASSWORD`, `JWT_SECRET` từ `.env` ở thư mục gốc (xem `.env.example`).
  - Xóa `selectMealPlan`; dùng chung `normalizeFoodText`; helper test `seedRecipesAsRecords`; xóa 10 ảnh không dùng.
  - Đổi tên nutriplan → nouri (package, `/api/health`, email demo `demo@nouri.vn`, key lưu phiên có chuyển key cũ); giữ tên database.
  - Bỏ `.agents/`, `skills-lock.json` khỏi git.
  - CSS: xóa selector chắc chắn không dùng; tách `styles.css` thành 28 file `src/styles/NN-<module>.css` (CSS build giống hệt từng byte).
  - Backend: thuật toán xếp thực đơn tách sang `meal-plan-generator.ts`.
  - Frontend: tách `PantryPage` vào `components/pantry/` + logic `features/pantry/pantry.logic.ts` (so ảnh 0 điểm ảnh lệch, 20 bước Playwright đạt).
- [x] (a) Sửa tiêu đề trang chi tiết công thức bị thanh menu che.
  - Nguyên nhân: không đưa trang về đầu khi chuyển route; trang mở từ cache giữ vị trí cuộn cũ. Sửa chung bằng `components/ScrollToTop.tsx` + `utils/navigation.ts` (không cuộn khi Back/Forward, chỉ đổi query, hoặc đổi thực đơn trong trang Thực đơn).
  - [x] Trang Trợ lý AI: khi vào trang chỉ cuộn bên trong khung chat (`scrollChatToLatest`), sau khi gửi tin mới cuộn cả trang tới câu trả lời. Chưa kiểm tra bằng Playwright.
- [x] Trước (c): tách component `DashboardPage` vào `components/dashboard/` (`OverviewHero`, `TodayMetrics`, `InsightCard`, `RecommendedRecipes`, `WaterStrip`), commit riêng, so ảnh trước/sau.
- [x] (c) Khối "Dành cho bạn" trên trang chi tiết: số nguyên liệu đã có trong kho / tổng và nguyên liệu còn thiếu; % calo so với mục tiêu ngày; cảnh báo dị ứng/không thích (dùng lại logic backend).
  - Gợi ý công thức ở Dashboard theo hồ sơ, **dùng chung logic backend** (`dietary.service.ts`) với khối "Dành cho bạn": hiện `dashboard.service.ts` chỉ lấy 3 món đầu theo `createdAt`, không lọc chế độ ăn/dị ứng (người ăn chay có thể thấy "Phở bò"); dòng "Dùng nguyên liệu trong kho" luôn hiện dù không dựa vào kho; ảnh chưa dùng `imageUrl`. Khi làm thì gom luôn logic so khớp đang chép ở frontend (`asWords` trong `meal-plans.logic.ts`) về backend.
  - [x] Backend: `services/recipe-fit.service.ts` (dùng `dietary.service.ts`, `normalizeFoodText`). `GET /api/recipes/:id/for-you` trả nguyên liệu có/thiếu (so theo tên, có/không; khác đơn vị vẫn tính "có" và ghi `unitMismatches`; món hết hạn không tính), % calo so với mục tiêu ngày, cảnh báo dị ứng/không thích/xung đột chay–thuần chay. Dashboard: chỉ gợi ý món hợp hồ sơ, ưu tiên món dùng nguyên liệu sắp hết hạn (≤3 ngày, cùng ngưỡng thông báo) rồi món dùng nhiều nguyên liệu trong kho; trả thêm `totalIngredients`, `pantryIngredientCount`, `expiringIngredientCount`, `imageUrl`. Có test.
  - [x] Frontend: khối "Dành cho bạn" ở cột phải trang `/recipes/:id`, dưới "Cách làm" (`components/recipes/RecipeForYouCard.tsx`, logic `features/recipes/recipe-for-you.logic.ts`; lỗi/đang tải chỉ ảnh hưởng khối này; mutation kho/hồ sơ làm mới khóa `["recipes","for-you"]`). Thẻ gợi ý Dashboard: dòng kho theo số liệu thật (ưu tiên "Dùng N nguyên liệu sắp hết hạn", ẩn khi không dùng gì trong kho), ảnh dùng `imageUrl`. Có test.
  - [x] Đã kiểm tra bằng Playwright: dị ứng Hải sản (Dashboard không gợi ý món cá/tôm, trang Cá kho tộ có cảnh báo), Ăn chay (Dashboard không gợi ý món thịt), số "có trong kho" khớp kho thực tế; điện thoại hiển thị ổn. Hồ sơ demo đã trả về ban đầu.
  - `asWords` chưa chuyển (mealPlanSuggestions còn dùng) → xem "Việc làm sau".
  - [x] Trên điện thoại (≤900px), cảnh báo theo hồ sơ hiện ngay sau phần thông tin chính của món; máy tính giữ trong khối "Dành cho bạn".
- [x] Trước (d): tách component `RecipeDetailPage` vào `components/recipes/` (`RecipeDetailHero`, `RecipeNutritionStrip`, `RecipeIngredientsCard`, `RecipeStepsCard`, `RecipeDetailStates`), commit riêng, so ảnh trước/sau giống hệt.
- [x] (d) Chỉnh số khẩu phần trên trang chi tiết (1 → 12, mặc định theo công thức, chỉ hiển thị): định lượng nhân tỷ lệ, làm tròn theo đơn vị (g/ml số nguyên, kg/lít 0,01, cái/gói bội số 0,5); dinh dưỡng/calo vẫn ghi cho 1 khẩu phần. Có test, đã thử bằng Playwright.

Đã xong GĐ2c, gộp vào `main`.

### Giai đoạn 2b — Đính kèm công thức vào bài viết
- [x] Trước tiên: tách component `CommunityPage` vào `components/community/` (`CommunityHero`, `PostComposer`, `PostCard`, `CommentForm`, `CommunitySidebar`, `CommunityFeedStates`), commit riêng, so ảnh trước/sau giống hệt (máy tính + điện thoại; feed trống, feed có bài/bình luận/lượt thích, `?post=`); đăng bài, thích, bình luận, `?post=` đã thử bằng Playwright.
- [x] Schema: `CommunityPost.recipeId` tùy chọn (FK tới `Recipe`, `onDelete: Restrict`, có index), migration `20261030000000_add_community_post_recipe`.
- [x] API đăng bài nhận `recipeId` (cuid, công thức phải tồn tại, không thì 422 "Công thức đính kèm không tồn tại."); bài cần có chữ hoặc công thức (chỉ có công thức thì `content` = ""). Feed và bài vừa đăng trả `recipe` tóm tắt (`id, name, imageUrl, calories, prepMinutes, cookMinutes`) hoặc `null`; chỗ kiểm tra "được phép gắn" là `assertAttachableRecipe` (GĐ3 thêm điều kiện không bị ẩn).
- [x] FE: hiện lại nút "Công thức" (nút "Ảnh" vẫn ẩn đến GĐ3); ô chọn công thức tìm theo tên không phân biệt dấu, xem trước và bỏ chọn trước khi đăng; bài viết hiển thị thẻ công thức (ảnh, tên, calo, thời gian) liên kết tới `/recipes/:id`; bài chỉ có công thức được phép.
- [x] Trang chi tiết công thức có nút "Chia sẻ lên cộng đồng" → `/community?shareRecipe=<id>` (gắn sẵn món, đưa con trỏ vào ô nhập, xóa tham số bằng `replace`).
- [x] Chỉ gắn công thức có sẵn; người dùng tự tạo công thức → hướng phát triển.
- [x] Đã thử bằng Playwright: chọn/tìm không dấu/xem trước/bỏ chọn, đăng bài có chữ + công thức, bài chỉ có công thức, bấm thẻ mở trang chi tiết, chia sẻ từ trang chi tiết, `?shareRecipe=` sai; điện thoại hiển thị ổn. `Restrict` chặn xóa công thức đang được gắn (thử trong DB). Dữ liệu thử đã xóa.

Đã xong GĐ2b, gộp vào `main`.

### Chốt hướng thiết kế UI (ngay trước GĐ3)
- [x] Đã chốt: `docs/design/DESIGN.md` (bản 2, 31/10/2026) là **nguồn sự thật về giao diện**. Mockup và DESIGN.md khác nhau → theo DESIGN.md. Làm lại toàn bộ UI theo mục "Làm lại toàn bộ giao diện" bên dưới.
  - **Phông chữ phải đủ tiếng Việt.** Khi đổi phông (ở bước này hoặc khi chỉnh UI), kiểm tra bằng Playwright các chữ có dấu chồng (ố, ặ, ữ, ỗ, ẫ, ợ) ở **mọi độ đậm đang dùng và chữ nghiêng**; khai báo phông dự phòng có tiếng Việt (Noto Serif cho chữ có chân, Noto Sans cho chữ không chân), không để rơi về Georgia. Lý do: Georgia không có chữ ghép sẵn như "ố" nên trình duyệt ghép "ô" + dấu rời và đặt lệch ("Sô ́ng"); đã sửa bằng Noto Serif ở nhánh `fix-landing-tieng-viet`. Test `source-nfc.test.ts` (frontend, backend) chỉ chặn dấu rời trong mã nguồn, không phát hiện lỗi phông.

### Lộ trình mới (chốt 31/10/2026)
| Thời gian | Việc |
|---|---|
| 31/10–7/11 | Làm lại toàn bộ giao diện, lượt UI-1 → UI-12 (nhánh `ui-moi`) |
| 8–10/11 | GĐ3b |
| 11–14/11 | GĐ3c |
| 15–17/11 | GĐ4 — Bảo mật tài khoản |
| 18–21/11 | GĐ5 — Nghiệp vụ bổ sung |
| 22–23/11 | Dự phòng |
| từ 24/11 | Tài liệu (`REPORT_NOURI.md`) |

Nội dung GĐ3b, GĐ3c: xem hai mục "Giai đoạn 3b", "Giai đoạn 3c" (sau GĐ3).

### Làm lại toàn bộ giao diện (31/10–7/11) — nhánh `ui-moi`
Quy tắc (ngoài DESIGN.md):
- Đọc `docs/design/DESIGN.md` trước mỗi lượt; cuối mỗi lượt **tự nghiệm thu theo mục 15** và báo kết quả checklist mục 3. Ảnh nghiệm thu lưu ở `docs/design/screens/<lượt>/`.
- CSS mới ở `frontend/src/styles/ui/`, **chỉ dùng biến token** (`tokens.css`); test `features/ui/design-rules.test.ts` chặn mã màu cứng, gradient, `backdrop-filter`, emoji, "→" (khi làm lại trang nào thì thêm thư mục CSS/component của trang đó vào danh sách của test). Token đổi → test `contrast.test.ts` và `docs/design/contrast.md`.
- Mỗi trang làm lại thì **gỡ CSS cũ của trang đó** (`styles/NN-*.css`). Không đổi nghiệp vụ, API, DB; không xóa chức năng. Trang chưa có mockup thì thiết kế theo DESIGN.md.
- Thành phần dùng chung ở `components/ui/` (import từ `components/ui`); `window.confirm` thay bằng `useConfirm()` khi làm lại trang có thao tác xóa/khóa.

- [x] UI-1 — Nền:
  - `styles/ui/tokens.css`: hai bộ màu đúng DESIGN.md mục 4 (đặt bằng `data-theme` trên `<html>` hoặc trên một vùng con), thang chữ, khoảng cách, bo góc, chuyển động, focus chung `:focus-visible`. CSS cũ đổi tên `--line/--muted/--surface` → `--legacy-*` để không trùng token (CSS build ra giống hệt từng byte khi đổi tên ngược lại; trang Đăng nhập và Landing so điểm ảnh 0 khác).
  - **Đã duyệt, DESIGN.md mục 4 đã cập nhật:** `--action-hover` tối #3A8570 → #3A8270 (chữ trắng 4.40 → 4.56:1); thêm `--action-text` (tối #8FC2AE) cho chữ/viền/focus vì `--action` tối làm chữ trên nền tối chỉ 2.9:1. `--action` chỉ dùng làm nền. Thêm `--on-action`, `--shadow-overlay`, `--backdrop`. Chi tiết: `docs/design/contrast.md`.
  - Phông: Fraunces + Be Vietnam Pro (Google Fonts, có subset tiếng Việt), dự phòng Noto Serif/Noto Sans; Playwright xác nhận mọi glyph của "Sống uống ặc ữ ỗ ẫ ợ Đậu hũ" ở Be Vietnam Pro 400/500/600/700 + nghiêng 400/500/600 và Fraunces 400/500/600 + nghiêng đều vẽ bằng đúng phông (không rơi về phông hệ thống).
  - Sáng/tối: `features/theme/` (mặc định sáng, khóa `nouri.theme`, đọc/ghi bọc try/catch, đồng bộ giữa các tab); script inline trong `index.html` đặt `data-theme` trước khi tải ứng dụng (không nháy màu); `ThemeToggle` (aria-pressed). Nút chuyển gắn vào menu ở UI-2.
  - `components/ui/`: Button/ButtonLink/IconButton, Field, Chip/Tag, Card, PageHeader, Skeleton/LoadingState/EmptyState/ErrorState, Logo, ConfirmDialog (`<dialog>` gốc: khóa focus, Esc = Hủy, trả focus) + `ConfirmProvider`/`useConfirm` (đã gắn ở `main.tsx`), ThemeToggle. Logic + test: `features/ui/ui.logic.ts`, `features/theme/theme.logic.ts`, `features/ui/contrast.logic.ts`.
  - Trang `/dev/ui` (chỉ khi `import.meta.env.DEV`; bản build không có mã/CSS của trang): mọi thành phần ở cả hai chế độ. Nghiệm thu Playwright 35/35 (phông, không cuộn ngang 320/390/1440, Tab 39 điểm dừng đều thấy focus, hộp xác nhận, vùng bấm ≥ 44px, không nháy màu, lỗi localStorage).
  - Đã sửa (sau UI-1): ứng dụng sập khi trình duyệt chặn localStorage (getter ném lỗi ở `auth.storage.ts`). Mọi lần đọc/ghi/xóa storage trong `auth.storage.ts` đi qua hàm bọc try/catch; không ghi được vào đâu thì phiên giữ trong bộ nhớ của tab (mất khi tải lại). Có test (chặn hoàn toàn, ghi bị từ chối, xóa key cũ lỗi).
  - Chưa có ảnh mockup trong `docs/design/mockups/` (DESIGN.md nhắc tới); cần trước UI-3 (Tổng quan), UI-4 (Công thức), UI-5 (Kho).
- [x] UI-2 — Khung chung (DESIGN.md mục 13):
  - `components/layout/`: `SiteHeader` (logo, nhóm liên kết dạng viên, `ThemeToggle`, `NotificationCenter`, `AccountMenu`; ≤ 1200px liên kết thu vào nút "Menu điều hướng" mở danh sách ngay dưới, bàn phím dùng được, Esc đóng và trả focus, đóng khi chuyển trang/bấm ra ngoài/Tab ra ngoài), `AccountMenu` (Hồ sơ / Quản trị chỉ ADMIN / Đăng xuất), `SiteFooter` (chỉ trang có thật; © 2026 Nouri · Đồ án tốt nghiệp), `PublicHeader`, `AdminRoute`. Hook `features/layout/useDisclosure.ts`; logic + test `features/layout/layout.logic.ts`. Liên kết "Bỏ qua menu, tới nội dung".
  - "Hồ sơ" chuyển từ menu chính sang menu tài khoản. `User.role` (FE) tùy chọn; phiên cũ không có role → USER.
  - `/admin` (AdminRoute; USER → về `/dashboard`): trang tạm "đang xây dựng". `/privacy`, `/terms`: trang tĩnh ngắn (`pages/info/`, `PublicLayout`), nội dung theo dữ liệu thật Nouri lưu/gửi (đã đối chiếu schema và ngữ cảnh gửi OpenAI).
  - Landing: footer cũ → `SiteFooter`; bỏ `FooterBotanical`, `footerGroups`, hiệu ứng GSAP của footer, CSS `.landing-footer*`; Landing cố định chế độ sáng (`data-theme="light"`) tới UI-11.
  - Thông báo: giữ logic `NotificationCenter`; chuông dùng chấm `--dot` (số chưa đọc nằm trong tên đọc), bỏ "→", bảng đầy đủ chuyển sang `<dialog>` (khóa focus, Esc), trạng thái tải/lỗi/trống dùng `components/ui`, icon `Sparkles` → `Lightbulb`, bỏ câu cảm thán. CSS mới `styles/ui/notifications.css`.
  - Đã gỡ `20-notifications.css`, `21-navigation.css`, `23-app-navbar.css`. Khung mới: `styles/ui/shell.css` (nền `--bg`, menu dính đầu trang); `info-pages.css`, `admin.css`.
  - **Trang chưa làm lại:** `<main>` giữ lớp `main-content main-theme-* app-overview-palette` và khung giữ `topbar-layout` chỉ để CSS cũ bám; nội dung trang cố định chế độ sáng (`data-theme="light"`) vì CSS cũ đặt chữ tối thẳng trên nền. Mỗi lượt UI thêm route của trang vào `REDESIGNED_ROUTES` (`layout.logic.ts`) và gỡ các lớp này. Nền gradient bên trong từng trang cũ (`17-unified-palette.css`) gỡ khi làm lại trang.
  - Focus chung đổi sang `:focus-visible` (thay viền xanh nhạt tương phản thấp của `01-base.css`).
  - Nghiệm thu Playwright 58/58 (`docs/design/screens/UI-2/`): 7 trang cũ trong khung mới có nội dung, không cuộn ngang ở 320/390/1440; menu thu gọn, menu tài khoản theo vai trò, `/admin`, chuông/bảng thông báo, Tab 11 điểm dừng ở menu đều thấy focus, bỏ qua menu, 10 liên kết footer đều tới trang thật, Landing.
  - **Còn lại, có từ trước:** (1) đăng xuất xóa cache truy vấn khi trang còn hiển thị → vài request 401 ở `/login` (để GĐ4, khi làm lại đăng xuất); (2) trang Kho ở điện thoại: dòng bảng rộng 870px bị cắt trong khung 350px, và trang có `<main>` lồng (đã sửa ở UI-5).
- [x] UI-3 — Tổng quan (mockup `docs/design/mockups/tong-quan.html`):
  - `components/dashboard/`: `DashboardHero` (lời chào theo giờ + tên, H1 "Hôm nay *nấu gì?*", món gợi ý đầu tiên của API kèm lý do từ dữ liệu thật, "Xem công thức" + "Đổi món khác" xoay giữa các món gợi ý; không có món → "Tạo thực đơn"), `NutritionTodayCard` + `CalorieRing` (vòng calo chạy tới giá trị khi tải, tắt khi giảm chuyển động; 3 thanh đạm/tinh bột/béo), `TodayMealsCard` (bữa theo thứ tự sáng/trưa/phụ/tối, ảnh nhỏ, tên link chi tiết, nút "Đã ăn" ở bữa kế tiếp, có "Hoàn tác"), `PantrySnapshot` (số thực phẩm, sắp hết hạn 7 ngày "5+" khi đủ 5, đã hết hạn, "Cần dùng sớm" mở `/pantry?item=`, "Thêm thực phẩm"; chưa có "Quét hóa đơn"), `RecommendedRecipes` (thẻ đầu lớn hơn, nhãn tiếng Việt, ô tìm công thức giữ từ trang cũ), `WaterTracker` (khối phụ), `DashboardSkeleton`. Logic + test: `features/dashboard/dashboard.logic.ts`.
  - Số liệu: không đổi API. Đạm/tinh bột/béo đã ăn = công thức × khẩu phần của các bữa đã đánh dấu, lấy từ `GET /meal-plans/:id` (thực đơn đang dùng); "Đã ăn" dùng `PATCH /meal-plans/items/:id` có sẵn.
  - Bỏ dữ liệu giả của trang cũ: món mẫu dự phòng, ảnh gợi ý cố định, nước bắt đầu 5 ly (nay 0, ghi rõ chưa lưu), nút bookmark không hoạt động, "Nouri Insight/Tip", linh vật, hero lá/chanh, GSAP.
  - `recipeDietLabel` trả nhãn tiếng Việt (Cân bằng, Món chay, Thuần chay, Ít tinh bột, Giàu đạm) — đổi luôn nhãn ở trang Công thức cũ. Còn "Low Carb" trong `features/ai/ai.logic.ts` (để UI-7).
  - Gỡ CSS cũ: xóa `11-dashboard-palette-final.css`, `24-dashboard-v2.css`; bỏ 107 bộ chọn của Tổng quan cũ trong `01-base`, `03-dashboard`, `06-type-scale`, `09-dashboard-palette`, `17-unified-palette` (chỉ bỏ bộ chọn nhắm vào lớp không còn dùng ở đâu). So điểm ảnh 9 trang khác trước/sau ở 1440/390: Kho, Hồ sơ, Thực đơn, Trợ lý AI, Đăng nhập, Công thức 1440 giống hệt; Cộng đồng/Công thức 390 lệch < 400 điểm ảnh khử răng cưa chữ (không thấy bằng mắt); Landing, chi tiết công thức tự lệch giữa hai lần chụp (hiệu ứng/ảnh).
  - Nghiệm thu Playwright 38/38 (`docs/design/screens/UI-3/`): trước/sau 390/1440 sáng/tối, đánh dấu đã ăn + hoàn tác, đổi món, trạng thái trống (tài khoản mới), đang tải, lỗi + Thử lại, Tab 19 điểm dừng, 320px, tiêu đề Fraunces.
  - Dữ liệu thử: đã xóa 3 thực đơn thử của demo (qua API) và 2 tài khoản thử `thu-ui3-…` (theo yêu cầu người dùng; còn 2 người dùng: admin, demo).
- [x] Ảnh món (quyết định 31/10, sau UI-3): **không dùng ảnh tạm theo nhóm** (`/assets/recipe-*.jpg` gây sai món). Component dùng chung `components/ui/RecipeImage.tsx`: chỉ ảnh đã tải lên Cloudinary (`recipePhotoSrc`, `isUploadedImageUrl`) mới hiện; chưa có thì ô `--surface-2` kèm tên món (ảnh nhỏ: chữ cái đầu). Áp dụng ở Tổng quan, Công thức, Chi tiết, Cộng đồng (thẻ đính kèm, ô chọn món), Thực đơn, Landing carousel; trang cũ có CSS tương thích tạm `styles/ui/recipe-image-legacy.css` (gỡ khi làm lại trang). Bỏ `recipeImage`, `recipeImageSrc`, `mealItemImage`. Hero Tổng quan chỉ hiện ảnh khi món có ảnh thật (hiện tại chỉ có chữ).
- [x] UI-4 — Công thức + Chi tiết công thức (mockup `docs/design/mockups/cong-thuc.html`):
  - Danh sách (`components/recipes/`): `RecipesHero` (H1 "Bếp nhà, *nấu mỗi ngày.*", số món thật, ô tìm; `?q=` vẫn điền sẵn), `RecipeCategoryChips` (danh mục tiếng Việt không emoji: Healthy → Cân bằng, Low Carb → Ít tinh bột; số món thật `recipeCategoryCounts`; nút "Bộ lọc" giữ chức năng thu gọn), `RecipesForYou` (gợi ý theo hồ sơ của dashboard API: 1 thẻ lớn + thẻ nhỏ; thẻ lớn có "Có trong kho / Còn thiếu / % mục tiêu calo" từ `/recipes/:id/for-you`), `RecipeResults` + `RecipeCard` (lưới/danh sách, sắp xếp, phân trang, "Xóa bộ lọc" khi không có kết quả), `RecipesSkeleton`; trạng thái lỗi + Thử lại (mới).
  - Nút yêu thích **tạm ẩn**: trang cũ chỉ là state cục bộ (mất khi tải lại); lưu DB ở GĐ5 (FavoriteRecipe).
  - **Không làm "Nấu từ tủ bếp"** (mockup có): so khớp nguyên liệu với kho chỉ có ở backend (`recipe-fit.service.ts`) theo từng món; API không có danh sách theo nguyên liệu, làm ở frontend sẽ chép thêm logic so khớp (đang là việc cần gom về backend, xem "Việc làm sau"). "Dành cho bạn" đã ưu tiên món dùng nguyên liệu trong kho. Mục "Theo chủ đề" của mockup trùng với chip danh mục nên bỏ.
  - "Dành cho bạn" có 1 thẻ lớn + 2 thẻ nhỏ (dashboard API trả 3 gợi ý, không đổi API; mockup 1 + 3).
  - Chi tiết: `RecipeDetailHero` (nhãn, H1, mô tả, cảnh báo theo hồ sơ nền `--warn-bg` ngay dưới tên — điện thoại thấy ngay, thông số dạng nhãn có tên Thời gian/Khẩu phần/Calo, ảnh), `RecipeNutritionStrip`, `RecipeIngredientsCard` (giữ chỉnh khẩu phần), `RecipeStepsCard` (đánh số), `RecipeForYouCard` (cột phải dính khi cuộn: có trong kho x/y, còn thiếu, % calo, nút "Chia sẻ lên cộng đồng"; "Thêm vào thực đơn" để GĐ5), `RecipeDetailStates` (skeleton, không tìm thấy, lỗi + Thử lại). Món đã ngừng sử dụng: thông báo rõ, ẩn chia sẻ và "Dành cho bạn".
  - Gỡ CSS cũ: xóa `13-recipes.css`; bỏ 238 bộ chọn chết trong `01-base`, `02-legacy-pages`, `17-unified-palette`, `28-recipe-detail` (file 28 chỉ còn 1 quy tắc link món của trang Thực đơn, gỡ ở UI-6). Lớp mới trùng tên lớp cũ đã đổi (`recipes-view`, `recipe-panel`, `recipe-fit`, `recipes-pager`, `recipe-servings-hint`). So điểm ảnh 8 trang khác 1440/390: giống hệt (Landing 1440 tự lệch do hiệu ứng).
  - Nghiệm thu Playwright 46/46 (`docs/design/screens/UI-4/`): trước (Docker `main`)/sau 390/1440 sáng/tối; số món của chip khớp API; tìm, lọc, sắp xếp, phân trang, dạng danh sách; khẩu phần; cảnh báo và món ngừng sử dụng (giả lập phản hồi API, không đổi dữ liệu); không tìm thấy, lỗi, đang tải; Tab, 320px, tiêu đề Fraunces; ô tên món ở Cộng đồng (44×36) và Landing.
- [x] UI-5 — Kho thực phẩm + hộp thoại Thêm/Sửa (mockup `docs/design/mockups/kho.html`, `kho-them.html`):
  - `components/pantry/` (viết lại, lớp CSS tiền tố `kho-` để không trùng lớp cũ): `PantryHero` (H1 "Tủ bếp *của bạn*", tìm kiếm, "Thêm thực phẩm"; chưa có "Quét hóa đơn" — GĐ3c), `PantryStats` (4 ô trong một card, nút lọc `aria-pressed`: Tất cả / Sắp hết hạn / Đã hết hạn / Dưới mức tối thiểu, bấm lại ô đang chọn → Tất cả), `PantryFilterBar` (chip nhóm có số thật; thanh lọc tình trạng, nơi bảo quản, sắp xếp, danh sách/lưới), `PantryItems` (bảng thật `<table>`: tên + nhóm, số lượng + cảnh báo dưới mức tối thiểu, hạn + "Còn N ngày", nơi bảo quản, nhãn tình trạng, Sửa/Xóa 44px có aria-label; dòng sắp hết hạn nền `--warn-bg`; ≤ 760px mỗi dòng thành thẻ; dạng lưới), `PantryPager`, `PantrySide` ("Cần dùng sớm" + "Nấu gì từ kho?"), `PantryItemDialog`, `PantrySkeleton`. Hook `features/pantry/usePantryItemFocus.ts` (giữ hành vi `?item=`, dùng lại cho "Cần dùng sớm"; dòng được mở nhận focus).
  - "Dưới mức tối thiểu" dùng **cùng điều kiện** thông báo `PANTRY_LOW_STOCK` của backend (`minimumStock > 0` và số lượng ≤ mức tối thiểu); dòng ghi "Dưới mức tối thiểu 1 kg" hoặc "Chạm mức tối thiểu …".
  - "Nấu gì từ kho?": dùng gợi ý theo hồ sơ có sẵn của Tổng quan (`dashboardQueries.overview()`, API đã ưu tiên món dùng nguyên liệu sắp hết hạn/trong kho), chỉ hiện món có `pantryIngredientCount > 0`, không có thì ẩn khối. Không đổi API.
  - Bỏ: "Tiết kiệm ước tính" (`estimatedSavings`), "Mẹo bảo quản" (câu chung chung, không theo dữ liệu; DESIGN.md mục 14 không có), ảnh hero, GSAP, ô "Bảo quản lạnh" (thay bằng "Dưới mức tối thiểu"), `storageTip`.
  - Hộp thoại: `components/ui/Dialog.tsx` (`<dialog>` gốc: `showModal`, Esc đóng, trả focus; thêm vòng Tab vì Chrome cho Tab thoát ra thanh trình duyệt; bấm nền **không** đóng để không mất dữ liệu đang nhập). Đủ các trường của form cũ (kể cả Ghi chú — mockup không có); nơi bảo quản là nhóm radio 3 phần; ô ngày là `DateInput` (thêm props `id`, `aria-describedby`, `aria-invalid`, `className`, `inputClassName` để đặt trong `Field`). Kiểm tra theo trường `validatePantryForm` (hiện sau lần bấm lưu đầu, focus về trường sai đầu tiên). Nút "Hủy" / "Lưu vào kho" (sửa: "Lưu thay đổi"). Nhóm của thực phẩm cũ không có trong danh sách vẫn giữ làm lựa chọn.
  - Thông báo sau thao tác: `components/ui/Toast.tsx` (`role="status"`, tự ẩn 5 giây): "Đã lưu “…” vào kho.", "Đã lưu thay đổi cho “…”.", "Đã xóa “…” khỏi kho.". Xóa dùng `useConfirm()` nêu tên thực phẩm, nút "Xóa thực phẩm".
  - Trạng thái mới: lỗi tải kho + Thử lại; kho trống (một câu + "Thêm thực phẩm"); không có kết quả lọc + "Xóa bộ lọc".
  - Sửa lỗi cũ: bỏ `<main>` lồng; dòng bảng không còn rộng 870px. `.ui-card` trên điện thoại không còn ghi đè `padding: 0` của `ui-card--flush`.
  - Gỡ CSS cũ: xóa `04-pantry.css`, `08-pantry-palette.css`, `10-pantry-palette-final.css`, `27-pantry-v2.css`, ảnh `public/assets/pantry-hero.png`; bỏ bộ chọn chết của Kho (modal, form-grid, pantry-*) trong `01-base`, `02-legacy-pages`, `06-type-scale`, `17-unified-palette` (file 17 sửa tay vì có `:is(...)` chứa lớp còn dùng). So điểm ảnh 8 trang khác ở 1440/390 trước/sau gỡ: giống hệt, trừ Công thức 390 lệch khử răng cưa chữ (không thấy bằng mắt) và Tổng quan 1440 tự lệch giữa hai lần chụp.
  - Nghiệm thu Playwright 49/49 (`docs/design/screens/UI-5/`): trước (Docker `main`)/sau 390/1440 sáng/tối, hộp thoại thêm và lỗi trường 390/1440 sáng/tối, dạng lưới, dòng nổi bật, hộp xác nhận xóa, đang tải, lỗi, kho trống; luồng thêm (đúng trường, radio, ngày), sửa xóa trắng hạn → `null`, xóa (Hủy giữ lại), 4 ô thống kê khớp API, chip, thanh lọc, tìm, sắp xếp, phân trang, `?item=` ở trang 2 và khi đang lọc, `?item=` không còn, "Cần dùng sớm" mở đúng dòng; khóa focus/Esc/trả focus, Tab 42 điểm dừng, tương phản 16 cặp × 2 chế độ ≥ 4.5:1, 320px, Fraunces. Dữ liệu thử (tên "Thử UI5 …") tạo/xóa qua API, kho demo về 5 thực phẩm.
- [x] UI-6 — Thực đơn (`/meal-plans`, `/meal-plans/:id`; chưa có mockup, thiết kế theo DESIGN.md mục 14, lớp CSS tiền tố `td-`):
  - `components/meal-plans/`: `MealPlanHeader` (H1 tên thực đơn, phần ngày in nghiêng; nhãn trạng thái + nguồn thật + khoảng ngày; chọn thực đơn giữ route `/meal-plans/:id`; "Áp dụng thực đơn" cho bản nháp; "Xóa thực đơn"), `MealPlanCreateForm` (ô ngày `DateInput` + "Tạo thực đơn" + dòng "Cách tạo: Tạo bởi AI / Thuật toán gợi ý" theo `/api/ai/status`; ngày sai báo dưới ô), `MealDayTabs` (tablist 7 ngày, mũi tên/Home/End, chỉ ngày đang chọn nhận Tab; hôm nay viền + vạch nhấn và chữ "Hôm nay", màn hẹp hiện thứ viết tắt; mở thực đơn thì chọn sẵn hôm nay), `MealDayList` (bữa sáng/trưa/phụ/tối: `RecipeImage`, tên link chi tiết, calo, thời gian; "Đã ăn" — nút chính chỉ cho bữa kế tiếp; "Bỏ đánh dấu"; món cùng bữa ở ngày khác trong `<details>` vẫn đánh dấu được như trang cũ), `MealPlanSide` (dinh dưỡng các bữa của ngày so với mục tiêu + số liệu cả tuần; gợi ý), `ShoppingListCard` (nhóm theo loại, cả dòng là vùng bấm ≥ 52px, tên đọc "Đã mua: …"), `MealPlansSkeleton`.
  - Vòng calo và ba thanh đạm/tinh bột/béo của Tổng quan chuyển thành thành phần dùng chung `components/ui/NutritionMeters.tsx` (`CalorieRing`, `MacroList`; CSS `.ui-ring`, `.ui-macros` trong `components.css`); dòng nhắc chung `.ui-notice` (thay `dash-status`, `kho-notice`). So điểm ảnh Tổng quan trước/sau: giống hệt.
  - Logic (`meal-plans.logic.ts`, có test): `orderDayMeals`, `todayDayIndex`/`initialDayIndex`, `planDayLabels`, `planTitleParts`, `planTargets` (chỉ lấy từ hồ sơ; **bỏ số mặc định tự đặt** 2000 kcal/80 g…; chưa có hồ sơ → EmptyState "Tạo hồ sơ"), `dayNutrition` (đạm/tinh bột/béo × khẩu phần), `mealPlanDeleteConfirm`, `groupShoppingItems`/`shoppingGroupOf`, gợi ý có số liệu của thực đơn (`mealPlanSuggestions`, bỏ ảnh minh họa).
  - **Nhóm đi chợ:** backend không điền `ShoppingItem.category` (cột có trong schema nhưng luôn `null`), nên frontend đoán nhóm theo từ đầu tên nguyên liệu (Rau củ, Thịt & cá, Trứng & sữa, Đậu & hạt, Gạo, bún & bánh, Trái cây, Gia vị, Khác) — chỉ để trình bày, có `category` thì dùng `category`. Đã kiểm với 95 tên nguyên liệu của bộ seed. Nếu muốn chính xác hơn: backend điền `category` khi tạo thực đơn (việc sau, cần quyết định).
  - Bỏ: ô tìm kiếm món (trùng ô tìm ở trang Công thức), link "Thêm món"/"Thêm món vào thực đơn"/"Chọn món" (chỉ mở trang Công thức, chưa có chức năng — làm thật ở GĐ5), thẻ "Tối ưu thực đơn" (link chung chung sang Trợ lý AI), giờ ăn cố định "07:00 – 09:00", nhãn "Dễ thực hiện"/nhãn chế độ ăn tiếng Anh trên thẻ món, ô "Đủ/Gần đủ", ảnh hero, icon trang trí.
  - Trạng thái: chưa có thực đơn (EmptyState + ô ngày + "Tạo thực đơn"), đang tạo (dòng chờ nêu ngày bắt đầu và cách tạo, nút khóa), đang tải (skeleton), lỗi + Thử lại, không tìm thấy (dòng nhắc như cũ). Đổi ngày chỉ đổi state; đổi thực đơn giữ vị trí cuộn (`ScrollToTop` có sẵn). Thông báo: tạo, áp dụng, xóa dùng `Toast`; đã ăn dùng dòng nhắc kèm "Hoàn tác" như Tổng quan.
  - Gỡ CSS cũ: xóa `07-meal-plans.css`, `12-meal-plans-palette.css`, `28-recipe-detail.css`; bỏ phần Thực đơn trong `17-unified-palette.css` (sửa tay các `:is()` dùng chung với Trợ lý AI/Hồ sơ), `.form-notice` và khối `.date-input` cũ trong `01-base.css` (ô ngày giờ chỉ dùng `.ui-date`), dòng `menu-*` trong `recipe-image-legacy.css`. Script tỉa CSS đã sửa: lớp chết nằm trong `:is()/:where()/:not()` thì chỉ cảnh báo; lần chạy này script làm lệch khoảng trắng `22-landing.css` nên file đó đã khôi phục nguyên bản. So điểm ảnh 8 trang khác ở 1440/390: giống hệt, trừ Công thức 390 và Kho 390 lệch khử răng cưa chữ (rải theo dòng chữ, không thấy bằng mắt).
  - Nghiệm thu Playwright 44/44 (`docs/design/screens/UI-6/`): trước (Docker `main`)/sau 390/1440 sáng/tối, danh sách đi chợ, chưa có thực đơn (4 ảnh), đang tạo, đang tải, lỗi, hộp xác nhận xóa, đã ăn; luồng tạo (ngày sai bị chặn), đổi thực đơn (giữ cuộn), đổi ngày (không tải lại, bàn phím), đã ăn + hoàn tác + bỏ đánh dấu, món ngày khác, đã mua/bỏ tick, áp dụng, xóa (Hủy giữ lại; nêu tên, đang áp dụng, hậu quả), thực đơn không tồn tại, "Xem cả tuần" từ Tổng quan, link thông báo (giả lập, không đổi trạng thái đã đọc); tương phản 19 cặp × 2 chế độ ≥ 4.5:1, Tab 72 điểm dừng, 320px, phông tiêu đề. Dữ liệu thử: thực đơn tạo/xóa qua API; demo về 0 thực đơn như đầu lượt.
- [x] UI-7 — Cộng đồng + Trợ lý AI (chưa có mockup; tiền tố lớp CSS `cm-`, `as-`):
  - **Cộng đồng** (`components/community/`): `CommunityHero` (H1 "Cộng đồng *bếp nhà*"), `PostComposer` (giữ đủ: chữ ≤ 2000 ký tự + bộ đếm, tối đa 4 ảnh có xem trước/bỏ từng ảnh và kiểm tra định dạng/dung lượng, gắn công thức qua `RecipePicker` tìm không dấu; ≤ 480px hai nút "Ảnh", "Công thức" một hàng, cụm "Đăng bài" hàng riêng), `PostCard` (tác giả + thời gian thật có `title` giờ đầy đủ, nội dung, `PostImages` 1 ảnh to bản 1200px / 2–4 ảnh lưới bản 640px qua `optimizedImageUrl`, `RecipeAttachmentCard` dùng `RecipeImage` + nhãn "Đã ngừng sử dụng", Thích/Bình luận/Chia sẻ, bình luận như cũ), `CommunityGuide` (cột phải: cách đăng món kèm ảnh và công thức).
  - Menu "…" chỉ trên bài của mình (so `author.id` với người đăng nhập): "Xóa bài" gọi `DELETE /api/community/:postId` có sẵn; `ConfirmDialog` nêu số ảnh, bình luận, lượt thích bị xóa cùng bài; xong thì bỏ khỏi cache bảng tin và báo "Đã xóa bài viết.". Bài người khác không có menu. Logic + test: `isOwnPost`, `deletePostConfirm`, `communityExactTime`, `deleteCommunityPost`, `removeCommunityPost`.
  - Bỏ (ghi lại cho GĐ5): nút "Lưu" bài và "Theo dõi" (chỉ là state cục bộ), "Thành viên nổi bật", "Chủ đề" (số giả), nhãn "Thành viên tích cực" trên mọi bài, ảnh hero/linh vật. Giữ `?post=` (cuộn + làm nổi bật), `?shareRecipe=` (gắn sẵn món, focus ô nhập, báo lỗi khi sai), giới hạn ký tự.
  - **Trợ lý AI** (`components/assistant/`): `AssistantChat` (khung chat cao theo màn hình, cuộn bên trong, nhận focus để cuộn bằng bàn phím; tin người dùng căn phải nền `--surface-2`, tin trợ lý căn trái nền `--surface` viền `--line`; thời gian thật dưới mỗi tin; ô nhập + "Gửi" ở đáy khung, Enter gửi / Shift+Enter xuống dòng; khi chờ: câu hỏi hiện ngay + "Nouri đang trả lời..." `role="status"`; chưa có lịch sử: EmptyState kèm câu hỏi gợi ý, không còn lịch sử mẫu giả), `AssistantSide` (ngữ cảnh, gợi ý câu hỏi, câu hỏi gần đây như cũ).
  - Ngữ cảnh ghi **đúng điều backend gửi**: thẻ "Trợ lý dựa vào" hiện hồ sơ (chế độ ăn tiếng Việt, kcal, dị ứng, không thích), kho (số thực phẩm, món sắp hết hạn) và thực đơn (xem mục "Trợ lý AI dùng thực đơn" ngay dưới; lúc làm UI-7 backend chưa gửi thực đơn).
  - Gợi ý câu hỏi theo dữ liệu thật (`assistantPromptSuggestions`, có test): tên món sắp hết hạn + số ngày, chỉ tiêu đạm, chế độ chay/thuần chay, dị ứng; thiếu dữ liệu thì dùng câu chung. Nhãn chế độ ăn tiếng Việt (bỏ "Low Carb", "Giàu protein" → "Ít tinh bột", "Giàu đạm"). Chưa có OpenAI key (`/api/ai/status`): dòng nhắc "đang dùng câu trả lời mẫu (cùng một câu cho mọi câu hỏi)". Vào trang không cuộn cả trang (giữ `scrollChatToLatest`).
  - Bỏ: thanh ngữ cảnh 4 ô, thẻ "Mẹo dinh dưỡng hôm nay", "Tính năng AI", 4 thẻ hành động nhanh và 5 nút gợi ý chung chung, lịch sử mẫu giả, linh vật `ai-mascot.png`, emoji.
  - Gỡ CSS cũ: xóa `14-assistant.css`, `16-assistant-dashboard.css`, `18-community.css`; bỏ phần Trợ lý/Cộng đồng trong `01-base.css`, `02-legacy-pages.css` (gồm `.message`, keyframes `message-in`, `pulse`), `17-unified-palette.css` (sửa tay các `:is()` dùng chung với Hồ sơ), dòng `community-*` trong `recipe-image-legacy.css` (file chỉ còn dòng Landing). So điểm ảnh 7 trang khác ở 1440/390: giống hệt hoặc chỉ lệch khử răng cưa chữ ở chữ menu/footer (nhìn không thấy; chụp lại lần hai ra cùng kết quả).
  - Nghiệm thu Playwright 59/59 (`docs/design/screens/UI-7/`): trước (Docker `main`)/sau 390/1440 sáng/tối cả hai trang; bài 1 ảnh, 3 ảnh, có công thức (từng thẻ, 2 chế độ, 2 cỡ); menu xóa bài, hộp xác nhận; ô đăng bài 320px; chat trống, có lịch sử (phản hồi API giả lập vì chưa có OpenAI key), đang trả lời; luồng đăng bài chữ / có ảnh + công thức (quá 4 ảnh bị chặn), thích/bỏ thích, bình luận, xóa bài (Hủy giữ lại; ảnh trên Cloudinary bị xóa, URL 404), bài người khác không có menu, `?post=`, `?shareRecipe=` (đúng/sai), gửi câu hỏi thật (Enter/Shift+Enter), bấm gợi ý; tương phản ≥ 4.5:1 cả hai chế độ, Tab (Cộng đồng 25, Trợ lý 6 điểm dừng), 320px, Fraunces.
  - Dữ liệu thử: bài "Thử UI7" tạo/xóa qua API; 2 tin nhắn chat của lần gửi thật mỗi lần chạy xóa bằng SQL (không có API xóa lịch sử chat), chỉ các dòng của demo tạo sau thời điểm bắt đầu chạy. Sau cùng: 0 bài, 0 ảnh, 0 bình luận, 0 tin nhắn; thư mục `nouri/posts` trên Cloudinary trống; thông báo chưa đọc của demo không đổi.
- [x] Trợ lý AI dùng thực đơn đang áp dụng (sau UI-7, commit riêng `3af3565`):
  - `backend/src/modules/ai/chat-context.ts` (hàm thuần, có test `chat-context.test.ts`): `chatMealPlanContext` tóm tắt thực đơn ACTIVE — các bữa hôm nay và 2 ngày tới theo giờ Việt Nam (bữa, tên món, calo, đã ăn hay chưa), tổng calo hôm nay (đã xếp, đã ăn, mục tiêu); không gửi nguyên liệu; không có thực đơn → `{ status: "chưa có thực đơn" }`. `chatProfileContext` bỏ `id`, `userId`, thời điểm tạo/sửa khỏi hồ sơ gửi AI. Không có email, mật khẩu, token.
  - `chat.service.ts` lấy thực đơn ACTIVE còn ngày từ hôm nay (chỉ chọn tên món, bữa, calo, đã ăn). Thẻ "Trợ lý dựa vào" và trang `/privacy` cập nhật theo. Đã thử trên Docker (thực đơn ACTIVE → chat 200, thẻ hiện đúng); dữ liệu thử đã xóa.
- [x] UI-8 — Hồ sơ + Đăng nhập/Đăng ký (chưa có mockup; tiền tố lớp CSS `hs-`, `dn-`):
  - **Hồ sơ** (`components/profile/`): `ProfileForm` chia 4 nhóm có tiêu đề (Thông tin cơ bản; Mục tiêu; Chế độ ăn và dị ứng; Khẩu vị), giữ đủ trường và giới hạn của backend (tên 2–80, tuổi 13–120 số nguyên, chiều cao 100–250, cân nặng 25–400, số bữa 3 hoặc 4, danh sách 30/30/20 mục ≤ 60 ký tự); giới tính, mục tiêu, chế độ ăn, số bữa là `ChoiceGroup` (radio dạng nút viên, `components/ui/ChoiceGroup.tsx`, CSS `.ui-choice`); dị ứng, món không thích, ẩm thực ưa thích nhập dạng thẻ `TagField` (Enter/dấu phẩy/nút "Thêm", nút bỏ từng thẻ 44px có tên đọc, báo trùng/quá dài/quá số mục; ẩm thực có gợi ý bấm thêm theo các nền ẩm thực của bộ món). `ProfileTargetsCard`: chỉ tiêu calo/đạm/tinh bột/béo từ hồ sơ đã lưu (cập nhật ngay sau khi lưu), câu giải thích cách tính theo `calculateNutritionTargets`, BMI theo số đo đang nhập; ≥ 1024px cột phải (dính khi cuộn), điện thoại ở trên cùng. Một nút "Lưu hồ sơ" ở cuối form, dòng "Có thay đổi chưa lưu"; lưu xong Toast "Đã lưu hồ sơ…"; lỗi dưới từng trường (focus trường sai đầu tiên); đóng/tải lại tab khi chưa lưu thì trình duyệt hỏi lại (`beforeunload`; điều hướng trong ứng dụng không chặn được vì router không phải data router).
  - Logic + test: `features/profile/profile.logic.ts` (`toProfileForm`, `validateProfileForm`, `addTag`, `isProfileDirty`, `bodyMassIndex`); `ProfileFormValues` đổi 3 trường danh sách từ chuỗi phân cách dấu phẩy sang mảng (dữ liệu gửi API không đổi).
  - Bỏ ở Hồ sơ: thanh "mức độ hoàn thiện", thẻ "NOURI AI", nhãn "Thành viên"/icon trang trí, câu "Tuyệt vời!…", thẻ BMI riêng (BMI chuyển thành một dòng trong thẻ chỉ tiêu).
  - **Đăng nhập/Đăng ký** (`components/auth/AuthForm.tsx`, `LoginPage`): ≥ 1024px hai cột (trái form, phải khối `--surface-2` với một câu giới thiệu cụ thể về Nouri; chưa có ảnh món thật), điện thoại chỉ form; logo + nút sáng/tối ở đầu trang. Chuyển Đăng nhập/Đăng ký như cũ; "Nhớ đăng nhập trên máy này" giữ hành vi (nhớ lựa chọn lần trước). Lỗi trường trước khi gửi (`validateAuthForm`) và lỗi máy chủ nói rõ (`authErrorMessage`, `features/auth/auth.logic.ts`, có test): "Email hoặc mật khẩu chưa đúng…", "Tài khoản này đã bị khóa…" (403 `ACCOUNT_LOCKED`), "Email này đã có tài khoản…" (409), mất kết nối. Hiện/ẩn mật khẩu có `aria-label` + `aria-pressed`. Bỏ câu quảng cáo ("Bắt đầu hành trình mới", "hành trình dinh dưỡng thông minh", "You are what you eat"), ảnh `login-hero-salmon-v1.png`, GSAP.
  - Gỡ CSS cũ: xóa `05-profile.css`, `15-profile-palette.css`, `26-login.css`, **`17-unified-palette.css`** (mọi trang trong khung ứng dụng đã làm lại nên lớp `app-overview-palette` không còn được gắn); bỏ bộ chọn chết trong `01-base`, `02-legacy-pages`, `03-dashboard`, `06-type-scale`, `19-logo`. So điểm ảnh 7 trang khác ở 1440/390: giống hệt (Landing 1440 tự lệch như các lượt trước).
  - Nghiệm thu Playwright 52/52 (`docs/design/screens/UI-8/`): trước (Docker `main`)/sau 390/1440 sáng/tối cả hai trang; lỗi trường hồ sơ, đã lưu, tài khoản mới (chưa có chỉ tiêu), đăng ký, sai mật khẩu, lỗi trường đăng nhập, tài khoản bị khóa; luồng đăng nhập có/không nhớ (localStorage/sessionStorage, nhớ lựa chọn), đăng ký (email trùng bị chặn), sai mật khẩu, tài khoản bị khóa (khóa bằng SQL trên tài khoản thử), sửa và lưu hồ sơ (chỉ tiêu cập nhật), thẻ bằng bàn phím, cảnh báo rời trang; tương phản ≥ 4.5:1 cả hai chế độ, Tab (Hồ sơ 22, Đăng nhập 8 điểm dừng), 320px, Fraunces. Hồ sơ demo trả về đúng như đầu lượt; 2 tài khoản thử `thu-ui8-…` đã xóa (còn admin, demo).
- [x] UI-9 — Quản trị phần 1: khung, Thống kê, Công thức (chưa có mockup; tiền tố lớp CSS `ad-`, CSS `styles/ui/admin.css`):
  - Cấu trúc theo CLAUDE.md: `layouts/AdminLayout.tsx` (H1 "Quản trị *Nouri*" + tab là liên kết có route riêng: Thống kê `/admin`, Công thức `/admin/recipes`, Người dùng `/admin/users`, Kiểm duyệt `/admin/moderation`, Nhật ký `/admin/audit-logs`; 3 tab sau là `AdminPlaceholderPage` "đang xây dựng" tới UI-10), `pages/admin/` (`AdminStatsPage`, `AdminRecipesPage`, `AdminRecipeEditorPage` cho `/admin/recipes/new` và `/admin/recipes/:id/edit`), `components/admin/` (`AdminWeeklyChart`, `AdminRecipeTable`, `AdminRecipeBasics`, `AdminRecipeLists`, `AdminRecipeImageField`), `features/admin/` (`admin.api.ts`, `admin.queries.ts`, `admin-recipes.logic.ts`, `admin-stats.logic.ts`, test `admin.logic.test.ts`). Giữ `AdminRoute` (USER → `/dashboard`). Các trang Admin tải riêng (`lazy`) để Recharts không vào gói của người dùng thường.
  - Thống kê: 4 số tổng có chú thích thật ("Trong đó N bị khóa", "Trong đó N đang ẩn"…); biểu đồ đường 12 tuần (người dùng, thực đơn, bài viết mới) bằng Recharts: màu token `--accent`, `--warn`, `--muted` (DESIGN.md mục 4) kèm kiểu nét và hình điểm khác nhau, nhãn trục, chú thích, tooltip, đọc được ở chế độ tối; bảng số liệu ẩn cho trình đọc màn hình (bọc trong `div` ẩn vì `<table>` không co về 1px); trạng thái đang tải / lỗi / 12 tuần chưa có hoạt động.
  - Công thức: bảng (ảnh nhỏ `RecipeImage`, tên + slug, ẩm thực, bữa, nhãn, calo, số lần được dùng, trạng thái), tìm (đợi 300ms), lọc Tất cả/Đang hiện/Đã ẩn, phân trang 20; ≤ 760px thành thẻ. Hành động: Sửa; Ẩn (ConfirmDialog nêu hậu quả) / Hiện lại; Xóa (ConfirmDialog) chỉ bật khi chưa được dùng — đã dùng thì nút tắt, lý do + gợi ý Ẩn đọc qua `aria-describedby`/`title`, cột "Được dùng" ghi số bữa/bài viết.
  - Form tạo/sửa: thông tin chung, thời gian, dinh dưỡng 1 khẩu phần, bữa (`mealTypes`) và nhãn chế độ ăn (Chip bật/tắt), nguyên liệu (thêm/xóa/lên/xuống; tên, số lượng, đơn vị `FoodUnit`, tùy chọn), các bước (thêm/xóa/lên/xuống). `validateRecipeForm` kiểm tra giống Zod backend (độ dài, khoảng số, số nguyên, ≥ 1 bữa/nhãn/nguyên liệu/bước, cấm "Bơ" trống); lỗi 422 nhãn chay (`details.violations`) gắn đúng dòng nguyên liệu vi phạm (`violationsByRow`) và đưa focus tới dòng đó. Ảnh: chọn ảnh (kiểm tra JPG/PNG/WEBP ≤ 5 MB trước khi gửi), xem trước; trang sửa có nút "Tải ảnh lên" (thay ảnh ngay, có trạng thái đang tải); trang tạo tải ảnh ngay sau khi tạo món (lỗi ảnh thì mở trang sửa của món vừa tạo kèm dòng nhắc); 503 → "Chưa cấu hình Cloudinary…"; "Bỏ ảnh hiện tại" có hiệu lực khi lưu. Lưu xong quay về danh sách với Toast "Đã tạo món “…”." / "Đã lưu thay đổi cho “…”.".
  - Sửa lỗi trong lượt: form sửa bị nạp lại (mất phần đang sửa) khi dữ liệu món tải lại sau khi tải ảnh lên → chỉ nạp form một lần cho mỗi món.
  - Nghiệm thu Playwright 58/58 với tài khoản Admin thật (đọc `ADMIN_EMAIL`/`ADMIN_PASSWORD` từ `.env`, không in ra) (`docs/design/screens/UI-9/`): Thống kê, danh sách, form mới ở 390/1440 sáng/tối; biểu đồ sáng/tối; form có lỗi; lỗi nhãn chay (cả trang và dòng); ảnh 503 (giả lập); hộp xác nhận ẩn, xóa. Luồng: USER vào `/admin` → `/dashboard`, API Admin với token USER → 403; tạo món thử có ảnh (sai nhãn Thuần chay bị chặn tại dòng "Trứng gà") → thấy ở trang Công thức người dùng (ảnh Cloudinary) → sửa + thay ảnh → ẩn (biến khỏi trang người dùng) → hiện → xóa; món đã dùng không xóa được (giả lập). Số tổng khớp API; màu 3 đường ≥ 3:1 so với nền thẻ ở cả hai chế độ; tương phản chữ ≥ 4.5:1; Tab (Thống kê 5, Công thức 91, Form 36 điểm dừng); 320px; Fraunces. So điểm ảnh 7 trang khác: giống hệt.
  - Dọn dữ liệu: món thử đã xóa (còn 33 món), thư mục `nouri/recipes` trên Cloudinary trống, 14 dòng nhật ký Admin của các lần chạy thử đã xóa bằng SQL (chỉ dòng có nhãn "Thử UI9…").
- [x] UI-10 — Quản trị phần 2: Người dùng, Kiểm duyệt, Nhật ký (cùng khung `AdminLayout`, CSS `styles/ui/admin.css` chỉ dùng token; xóa `AdminPlaceholderPage`):
  - `pages/admin/AdminUsersPage.tsx` (`/admin/users`): bảng tên + email, vai trò, ngày tạo, số bài viết, số thực đơn, trạng thái ("Đang hoạt động" / "Đã khóa từ HH:mm, dd/MM/yyyy" giờ Việt Nam); tìm theo tên/email (đợi 300ms, `?search=` điền sẵn — link từ Nhật ký), phân trang 20; ≤ 760px thành thẻ. Khóa / Mở khóa qua ConfirmDialog (khóa: người đó bị đăng xuất ở lần thao tác tiếp theo, không đăng nhập hay dùng được ứng dụng tới khi mở; dữ liệu giữ nguyên). Không có nút với chính mình ("Tài khoản của bạn: không tự khóa được.") và Admin khác ("Tài khoản Admin: không khóa được Admin khác."); API trả 400/403 thì hiện thông báo của máy chủ, trạng thái không đổi.
  - `pages/admin/AdminModerationPage.tsx` (`/admin/moderation`): bài mới nhất (10/trang): tác giả (tên, email), thời gian tương đối + giờ Việt Nam, nội dung, ảnh (`PostImages`, `optimizedImageUrl`), công thức (`RecipeAttachmentCard`), số thích/bình luận, các bình luận. "Xóa bài" / "Xóa" bình luận qua ConfirmDialog nêu số ảnh (xóa cả trên Cloudinary), bình luận, lượt thích và thông báo liên quan; không có bài → EmptyState; lỗi tải → Thử lại.
  - `pages/admin/AdminAuditLogsPage.tsx` (`/admin/audit-logs`): chỉ xem. Bảng thời gian (giờ Việt Nam), người thực hiện, hành động tiếng Việt (Tạo/Sửa/Ẩn/Hiện lại/Xóa món, Đổi ảnh món, Khóa/Mở khóa tài khoản, Xóa bài viết, Xóa bình luận), đối tượng (tên món / email / "Bài viết của …" / "Bình luận của …"), chi tiết (trường đã đổi, số ảnh/bình luận/lượt thích…). Lọc theo hành động và người thực hiện (danh sách Admin), phân trang 20. Đối tượng còn tồn tại có link (món → trang sửa, tài khoản → `/admin/users?search=<email>`): biết "còn tồn tại" bằng cách tải danh sách id món/người dùng qua API Admin có sẵn (`adminQueries.existing`, không thêm API).
  - Dùng chung: `components/admin/AdminListParts.tsx` (`AdminSearch`, `AdminPager`, trang Công thức cũng dùng); logic + test `features/admin/admin-people.logic.ts` (`vietnamTime`, `vietnamDate`, `lockBlockedReason`, `lockConfirm`, `deletePostConfirmText`, `deleteCommentConfirmText`, `AUDIT_ACTION_LABELS`, `auditTarget`, `auditDetails`, `auditTargetLink`). Thanh tab Admin trên màn hẹp tự cuộn tab đang chọn vào khung nhìn. Trang Công thức Admin thêm dòng "Món đã dùng … chỉ ẩn được, không xóa được."
  - **Sửa lỗ hổng phát hiện khi thử:** trước đây người bị khóa khi đang dùng chỉ thấy lỗi 403 mà không bị đăng xuất. `api/client.ts`: phản hồi 403 `details.code = "ACCOUNT_LOCKED"` → xóa phiên và về `/login?locked=1`; trang Đăng nhập báo "Tài khoản của bạn đã bị khóa nên đã bị đăng xuất…" (`isAccountLockedError`, có test; 403 khác giữ phiên).
  - Nghiệm thu Playwright 85/85 với tài khoản Admin thật (đọc từ `.env`, không in ra) (`docs/design/screens/UI-10/`): Người dùng, Kiểm duyệt (bài 2 ảnh + công thức + bình luận), Nhật ký ở 390/1440 sáng/tối; hộp xác nhận khóa (390/1440 sáng/tối), xóa bình luận, xóa bài; khóa bị từ chối; người dùng đã khóa; trang đăng nhập khi bị khóa; nhật ký có lọc; kiểm duyệt trống. Luồng thật: khóa demo (Hủy/Esc không khóa) → demo đang mở ứng dụng bị đăng xuất về `/login?locked=1`, đăng nhập lại bị chặn, token cũ 403 → mở khóa → đăng nhập lại được; demo đăng bài 2 ảnh + 2 bình luận (Admin thích) → Admin xóa 1 bình luận → xóa bài → `nouri/posts` trống, DB không còn bài/bình luận/thông báo liên quan; nhật ký đúng 4 dòng (khóa, mở khóa, xóa bình luận, xóa bài: "2 ảnh, 1 bình luận, 1 lượt thích, có công thức đính kèm"). Giả lập (không đổi dữ liệu): Admin khác, người đã khóa, phân trang, API 400/403, lỗi tải. Tương phản chữ ≥ 4.5:1 cả hai chế độ; Tab (Người dùng 7, Kiểm duyệt 9, Nhật ký 9 điểm dừng); 320px không cuộn ngang, tab đang chọn nằm trọn; Fraunces/Be Vietnam Pro. So điểm ảnh 7 trang khác ở 1440/390: giống hệt, trừ Landing 390 lệch 142 điểm ảnh trong ảnh hero (giải mã ảnh, nhìn không thấy; Landing không đổi).
  - Dọn dữ liệu: demo@nouri.vn đang mở khóa; 0 bài, 0 bình luận, `nouri/posts` trống; chỉ xóa các dòng nhật ký do lượt thử tạo (theo id, `createdAt` ≥ lúc bắt đầu), nhật ký về đúng số dòng trước lượt.
- [x] UI-11 — Landing (`/`, chưa có mockup; DESIGN.md mục 14 "Landing"; tiền tố lớp CSS `ld-`, CSS `styles/ui/landing.css`):
  - **Backend (commit riêng `fb3ac42`):** `GET /api/recipes/featured?limit=` công khai (đặt trước `requireAuth` như `/stats`): chỉ món đang hiện, chỉ trường tóm tắt (`id, slug, name, imageUrl, calories, prepMinutes, cookMinutes, dietTags, mealTypes`; không nguyên liệu, cách làm, `imagePublicId`, dữ liệu người dùng); `limit` mặc định 6, 1–12 (khác → 422). Chọn món ở `modules/recipes/featured-recipes.ts` (`pickFeaturedRecipes`): món có ảnh đã tải lên trước, rồi xen kẽ theo bữa sáng/trưa/tối/phụ (tên theo thứ tự chữ cái) để danh sách ngắn không toàn một kiểu món. Bộ món nhỏ nên lấy hết bản tóm tắt rồi chọn ở ứng dụng; bộ món lớn thì chuyển sang SQL. Test: không cần token, không gọi hồ sơ/kho kể cả khi gửi token, đúng danh sách trường, `where` có `hiddenAt: null`, giới hạn `limit`, thứ tự chọn.
  - **Frontend:** `LandingPage.tsx` (1.520 dòng → 39 dòng) chỉ ghép `components/landing/`: `LandingHeader` (bản cho khách của khung chung: logo, 4 liên kết neo dạng viên, chế độ tối, "Đăng nhập"/"Về Tổng quan"; ≤ 1200px neo thu vào nút "Các phần của trang", dùng `useDisclosure`), `LandingHero` (H1 "Biết tủ bếp còn gì, *tuần này ăn gì.*", một câu nói rõ Nouri làm gì, "Đăng ký miễn phí" + "Đăng nhập"; có món mang ảnh thật thì ảnh bên phải, chưa có thì chỉ chữ, không ô xám), `LandingBenefits` (3 việc: biết trong tủ còn gì / thực đơn 7 ngày theo hồ sơ / bớt đồ phải bỏ đi; việc đầu là card lớn, hai việc sau ngăn bằng đường kẻ; không icon), `LandingRecipes` (số món theo nhóm từ `/stats`, 6 thẻ món từ `/featured`; món của hero không lặp ở thẻ; thẻ đầu có ảnh lớn gấp đôi; thẻ chưa có ảnh chỉ có chữ; cả thẻ là vùng bấm; đang tải/lỗi + Thử lại/trống; thiếu số liệu thì ẩn số), `LandingSteps` (`<ol>` 4 bước đánh số: nhập kho → hồ sơ → thực đơn → đi chợ), `LandingCommunity` (chỉ mô tả, không số, không bài mẫu), `LandingSignup` (một nút chính). Footer dùng `SiteFooter`. Nội dung tĩnh ở `features/landing/landing.data.ts`, logic + test ở `landing.logic.ts`.
  - Khách bấm món → `/login?next=/recipes/:id`, đăng nhập xong mở đúng món; "Đăng ký miễn phí" → `/login?mode=register` (mở sẵn form đăng ký). `loginPath`, `safeNextPath` (`features/auth/auth.logic.ts`, có test): `next` chỉ nhận đường dẫn trong ứng dụng (`//…`, `https://…`, `/\…` về `/dashboard`). Đã đăng nhập: các nút thành "Về Tổng quan", thẻ mở thẳng chi tiết.
  - Landing theo chế độ sáng/tối người dùng chọn (bỏ `data-theme="light"` cố định). `html` cũng nhận nền `--bg` khi trang dùng khung mới (`shell.css`). Tiêu đề cấp 3 của Landing đặt rõ Be Vietnam Pro vì `01-base.css` còn đặt Manrope cho h1–h3 (gỡ ở UI-12).
  - Gỡ: `22-landing.css` (2.107 dòng), `25-landing-hero-footer.css` (1.527 dòng), `19-logo.css`, `ui/recipe-image-legacy.css`, `components/Logo.tsx` cũ, 17 ảnh trang trí chỉ Landing dùng (hero-composition, feature-*, community-card-*…), gói `gsap` và `@gsap/react` (Landing là nơi duy nhất dùng); carousel, blob, lá, kính mờ, hiệu ứng khi cuộn, mọi số minh họa. Giữ 5 ảnh `/assets/*.jpg` mà `seed-data.ts` còn ghi vào DB.
  - Lệch so với DESIGN.md: ảnh hero tỉ lệ 4:3 trong cột phải (mục 10 ghi 16:9) để cân với cột chữ; ≤ 1024px ảnh hero xếp dưới chữ thay vì làm nền mờ sau chữ (mục 12) để không phải phủ lớp mờ lên ảnh; thẻ món chưa có ảnh không vẽ ô `--surface-2` (mục 10) để Landing không thành lưới ô xám khi chưa tải ảnh món.
  - Tốc độ (bản build, `docs/design/screens/UI-11/toc-do.md`): máy tính FCP/LCP 1,30/2,30 s → 0,55/0,55 s, tải 11,6 MB → 0,66 MB, 41 → 22 request; điện thoại (mạng chậm, CPU ×4) FCP/LCP 6,69/6,96 s → 3,24/3,24 s. JS gói chính 746 → 564 KB, CSS 293 → 160 KB (chưa nén).
  - Nghiệm thu Playwright 41/41 (`docs/design/screens/UI-11/`): trước 390/1440 sáng/tối; sau 390/768/1440/1920 sáng/tối; có ảnh món (giả lập phản hồi `/featured` và ảnh, không đổi dữ liệu) 390/1440; đang tải, lỗi, menu mở, đã đăng nhập. Số nhóm khớp `/stats`, thẻ khớp `/featured` và đều là món đang hiện; không gradient/kính mờ/emoji/"→"/lớp `landing-*`/animation, không tải GSAP; chữ nghiêng chỉ ở H1; mỗi vùng tối đa 1 nút chính; neo không bị menu che; menu thu gọn (Esc trả focus); đăng ký mở sẵn form; bấm góc thẻ → đăng nhập → đúng món; `next` ngoài ứng dụng bị bỏ qua; tương phản 21 cặp ≥ 4.5:1 cả hai chế độ; Tab 20 điểm dừng; 320px; dấu chồng đúng phông. So điểm ảnh 6 trang ứng dụng (1440/390) và Đăng nhập, Chính sách (sáng/tối, 390/1440): giống hệt.
- [ ] UI-12 — Xóa CSS cũ còn lại (`styles/NN-*.css`, biến `--legacy-*`, `@import` phông cũ Manrope/Outfit; `01-base.css` còn đặt Manrope cho h1–h3; ảnh `public/assets/dashboard-*` có vẻ không còn dùng — kiểm tra rồi gỡ). Kèm: bỏ nhánh "trang chưa làm lại" trong `layouts/AppLayout.tsx` (lớp `main-content main-theme-* app-overview-palette`, `legacyTheme`) và `REDESIGNED_ROUTES` vì từ UI-8 mọi trang trong khung ứng dụng đã làm lại.

### Giai đoạn 3 — Admin + upload ảnh
Kế hoạch backend chia 7 lượt (mỗi lượt một commit), frontend Admin làm sau khi chốt UI:
1. Role/khóa tài khoản, `requireAuth` đọc DB, `requireAdmin`, seed Admin, seed không xóa/ghi đè món.
2. `Recipe.hiddenAt` + lọc món ẩn ở mọi chỗ (danh sách, tạo thực đơn + `reconcileAIPlan`, `assertAttachableRecipe`, chia sẻ, gợi ý Dashboard, "Dành cho bạn", `/api/recipes/stats`); chi tiết và feed trả cờ ẩn.
3. Admin công thức (tạo/sửa/ẩn/xóa khi chưa dùng → 409), bộ từ khóa chay chuyển từ `seed-data.test.ts` sang `dietary.service.ts`.
4. Admin người dùng (tìm kiếm, phân trang, khóa/mở) + service xóa bài/bình luận dùng chung + `DELETE /api/community/:postId` ("Xóa bài của tôi", giao diện để sau) + kiểm duyệt + thống kê theo tuần.
5. Hạ tầng Cloudinary + ảnh công thức. 6. Ảnh bài viết (`CommunityPostImage`). 7. Nhật ký thao tác Admin.

Quyết định đã chốt cho GĐ3:
- **Seed:** chỉ tạo món còn thiếu, không xóa, không ghi đè. `SEED_UPDATE_RECIPES=true` (mặc định tắt) để cố ý cập nhật lại các món gốc. Admin tạo từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` (đã có email thì chỉ nâng quyền, giữ mật khẩu); seed không in mật khẩu.
- **Quyền/khóa:** đọc `role` và `lockedAt` từ DB ở mỗi request (không để trong JWT) để khóa có hiệu lực ngay; tài khoản khóa → 403 `details.code = "ACCOUNT_LOCKED"`; đăng nhập kiểm tra mật khẩu trước rồi mới báo khóa. Admin không khóa được chính mình hay Admin khác. GĐ4: khóa tài khoản thì thu hồi refresh token trong cùng transaction.
- **"Dành cho bạn" của món ẩn:** 404, frontend ẩn khối; trang chi tiết hiện "Món này đã ngừng sử dụng".
- **Ảnh:** jpg/png/webp (kiểm tra cả byte đầu file), tối đa 5 MB/ảnh, tối đa 4 ảnh/bài; xóa EXIF (nhất là GPS) khỏi ảnh bài viết; hiển thị bằng URL Cloudinary đã tối ưu (`f_auto`, `q_auto`, giới hạn chiều rộng); thay ảnh thì xóa ảnh cũ theo `publicId` sau khi cập nhật DB thành công.
- **Nhật ký thao tác Admin:** có làm (lượt 7).
- **"Xóa bài của tôi"** (`DELETE /api/community/:postId`): làm ở lượt 4, dùng chung service xóa với Admin; giao diện để sau.
- **Thống kê theo tuần:** theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), tuần bắt đầu thứ Hai.

- [x] Lượt 1 — Role + middleware + seed tài khoản Admin:
  - Migration `20261031000000_add_user_role_and_lock` (`User.role` USER/ADMIN, `User.lockedAt`).
  - `requireAuth` đọc quyền/khóa qua `services/account-status.service.ts`; `requireAdmin`; `AuthenticatedRequest.userRole`. Đăng nhập/đăng ký và `GET /api/profile` trả thêm `role`; đăng ký không nhận `role`.
  - Test dùng bản giả chung `getAccountStatus` trong `src/test/setup.ts` (`backend/vitest.config.ts`), mặc định USER chưa khóa.
  - Seed: `prisma/seed-steps.ts` (món, Admin), biến seed khai báo bằng Zod trong `src/config/seed-env.ts`; `backend/.env.example` chỉ còn tên biến; `docker-compose.yml` truyền biến seed.
  - Hạn chế: chạy lại seed không còn tự xóa bộ món cũ (trước GĐ2c); muốn bỏ hẳn thì reset database.
  - Đã kiểm tra trên Docker: migration áp dụng; Admin đăng nhập trả `role` ADMIN, demo trả USER. Chưa có route Admin nên 403 của `requireAdmin` mới kiểm bằng test; kiểm lại trên Docker ở lượt 3.
- [x] Lượt 2 — Món bị ẩn:
  - Migration `20261031010000_add_recipe_hidden_at` (`Recipe.hiddenAt`, index). Điều kiện dùng chung `visibleRecipeWhere` trong `services/recipe-visibility.ts`.
  - Lọc ở: `listRecipes` (kéo theo trang Công thức, gợi ý trang Thực đơn, ô chọn công thức khi đăng bài), `generateWeeklyPlan` (OpenAI + dự phòng; AI trả id món ẩn thì `reconcileAIPlan` thay), `assertAttachableRecipe` (422 "Món này đã ngừng sử dụng."), gợi ý Dashboard, "Dành cho bạn" (404), `/api/recipes/stats` (cả 6 số).
  - Không lọc: chi tiết (`hidden: true`), thực đơn cũ, feed (`recipe.hidden`).
  - Frontend tối thiểu: trang chi tiết hiện "Món này đã ngừng sử dụng", ẩn nút chia sẻ và khối "Dành cho bạn"; `?shareRecipe=` từ chối món ẩn; thẻ công thức trong bài cũ có nhãn "Đã ngừng sử dụng".
  - Đã kiểm tra trên Docker bằng cách tạm ẩn "Cá kho tộ" (danh sách 32 món, stats 32, chi tiết `hidden`, "Dành cho bạn" 404, gắn bài 422, Dashboard không gợi ý, giao diện đúng), sau đó hiện lại.
- [x] Lượt 3 — Admin quản lý công thức:
  - `modules/admin/` (`admin.routes.ts` gắn `requireAuth` + `requireAdmin` cho mọi route, schema/controller công thức); nghiệp vụ ở `modules/recipes/recipe-management.service.ts`.
  - API: `GET /api/admin/recipes` (search, status all/visible/hidden, page, pageSize ≤ 50, kèm `usage` = số `MealPlanItem` và bài viết), `GET /:id`, `POST`, `PUT /:id`, `PATCH /:id/visibility`, `DELETE /:id` (đã dùng → 409 kèm `usage`, gợi ý ẩn; FK Restrict là lớp chặn cuối).
  - Zod: đơn vị thuộc `FoodUnit`, ≥ 1 nguyên liệu (≤ 40), ≥ 1 `mealTypes`, 1–20 bước, số dinh dưỡng không âm, cấm nguyên liệu "Bơ" trống, ảnh chỉ `/assets/...` hoặc `https://`.
  - Nhãn chay: `findDietViolations` + `normalizeDietTags` trong `dietary.service.ts` (bộ từ khóa chuyển từ `seed-data.test.ts`, test seed dùng chung); sai nhãn → 422 kèm `details.violations`; VEGAN tự thêm VEGETARIAN. Chỉ xét tên nguyên liệu (món chay có thể tên "gà chay").
  - Slug: `utils/slug.ts` (bỏ dấu, "đ" → "d", hậu tố -2, -3 nếu trùng; tạo trùng cùng lúc → 409). Sửa món **giữ nguyên slug** để seed vẫn nhận ra món gốc.
  - Sửa nguyên liệu bằng nested write (`deleteMany` + `create` trong một lệnh update, Prisma chạy trong một transaction).
  - Test: ma trận phân quyền 6 API × (401, USER 403, khóa 403, Admin 2xx), tạo/sửa/ẩn/xóa, nhãn chay sai, slug trùng, validate.
  - Đã kiểm tra trên Docker: USER gọi `/api/admin/recipes` → 403; Admin tạo món thử (slug `thu-gd3-dau-hu-sot-nam`, VEGAN + VEGETARIAN) → hiện ở trang Công thức; nhãn chay sai → 422; ẩn → biến mất khỏi danh sách; xóa món chưa dùng → 204. Đã xóa món thử (còn 33 món).
  - **Lượt 5 phải siết lại:** `imageUrl` (schema Admin công thức) chỉ nhận `/assets/...` hoặc URL Cloudinary của dự án (đúng cloud name, thư mục của Nouri), không nhận mọi `https://` như hiện tại.
- [x] Lượt 4 — Admin người dùng, kiểm duyệt, thống kê:
  - Người dùng (`modules/admin/admin-users.service.ts`): `GET /api/admin/users` (tìm theo tên/email, `pageSize` ≤ 50, kèm `postCount`, `mealPlanCount`, `locked`), `PATCH /api/admin/users/:id/lock` `{ locked }`. Tự khóa mình → 400; Admin khác → 403; khóa lại giữ thời điểm khóa đầu. Cập nhật trong `$transaction`, có chỗ ghi chú thu hồi refresh token (GĐ4).
  - Xóa dùng chung trong `community.service.ts`: `deleteCommunityPost(postId, actor)` (xóa thông báo `COMMUNITY_LIKE/COMMENT/REPLY` có `relatedId = postId` + xóa bài trong một transaction; like/bình luận Cascade) và `deleteCommunityComment(commentId, actor)` (xóa thông báo `community-comment:<id>`). Không thuộc quyền hoặc không tồn tại → 404.
  - API: `GET /api/admin/community/posts` (phân trang, kèm email tác giả, bình luận, số like), `DELETE /api/admin/community/posts/:postId`, `DELETE /api/admin/community/comments/:commentId`; người dùng `DELETE /api/community/:postId` ("Xóa bài của tôi", chưa có giao diện).
  - Thống kê `GET /api/admin/stats`: tổng (người dùng, số bị khóa, thực đơn, bài viết, công thức, số đang ẩn) + 12 tuần giờ Việt Nam, tuần bắt đầu thứ Hai, tuần trống = 0 (`admin-stats.logic.ts`; gom theo tuần ở ứng dụng, dữ liệu lớn thì chuyển sang SQL).
  - Test: ma trận phân quyền 6 API mới, khóa/mở khóa và các ca cấm, xóa bài/bình luận kèm thông báo, xóa bài người khác → 404 và bài còn nguyên, ranh giới tuần (Chủ nhật 23:59 / thứ Hai 00:00 giờ Việt Nam).
  - Đã kiểm tra trên Docker: khóa demo → API Kho 403 `ACCOUNT_LOCKED` (token cũ), đăng nhập đúng mật khẩu 403, sai mật khẩu 401; mở khóa → dùng lại bình thường; Admin tự khóa → 400; bài thử của demo có bình luận + like (2 thông báo) → Admin xóa → bài, bình luận, thông báo đều 0; `/admin/stats` khớp DB (tổng và theo tuần). Đã dọn dữ liệu thử, demo đang mở khóa.
- [x] Lượt 5 — Cloudinary + ảnh công thức:
  - Thư viện `multer` (bộ nhớ) và `cloudinary`. Biến `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` trong `env.ts` (đủ cả ba hoặc không có; giá trị rỗng từ docker compose coi như không có), hai file `.env.example`, `docker-compose.yml`. Nginx frontend nâng `client_max_body_size` lên 6m cho `/api/` (mặc định 1 MB sẽ chặn ảnh).
  - `services/image-file.ts` (nhận dạng jpg/png/webp theo byte đầu file, tối đa 5 MB), `services/image-upload.service.ts` (upload vào `nouri/recipes`/`nouri/posts`, lỗi Cloudinary → 502, `deleteImageQuietly` chỉ ghi log, `isProjectImageUrl`), `middleware/image-upload.ts` (trường `image`; chưa cấu hình → 503 trước khi đọc file; quá 5 MB, thiếu file, sai định dạng → 422).
  - `PUT /api/admin/recipes/:id/image`: upload → lưu `imageUrl` + `imagePublicId` (migration `20261031020000_add_recipe_image_public_id`) → lưu lỗi thì xóa ảnh vừa upload; lưu xong mới xóa ảnh cũ. `PUT /:id` đổi sang ảnh khác (vd. về ảnh nhóm `/assets`) cũng bỏ liên kết và xóa ảnh Cloudinary cũ.
  - `imageUrl` chỉ nhận `/assets/...` hoặc ảnh Cloudinary của đúng cloud name, trong thư mục `nouri/`.
  - Frontend `utils/images.ts`: `optimizedImageUrl` thêm `f_auto,q_auto,c_limit,w_...` cho ảnh Cloudinary (thẻ 640, chi tiết 1200, ảnh nhỏ 160); `recipeImageSrc` và ảnh gợi ý Dashboard dùng hàm này (lượt 6 dùng lại cho ảnh bài viết).
  - Test (giả lập Cloudinary): ma trận phân quyền API mới, 503 khi chưa cấu hình, GIF, file chữ đổi đuôi `.jpg`, quá 5 MB, thiếu file, 404, thay ảnh xóa ảnh cũ (sau khi lưu DB), DB lỗi thì xóa ảnh vừa upload, `imageUrl` ngoài phạm vi → 422, biến môi trường thiếu một phần → lỗi.
  - Đã kiểm tra trên Docker với Cloudinary thật: upload ảnh thử cho "Cá kho tộ" → hiện ở trang Công thức (bản 640px) và trang chi tiết (bản ≤ 1200px); thay ảnh lần hai → ảnh lần một bị xóa trên Cloudinary; trả về ảnh `/assets/recipe-salmon.jpg` → ảnh lần hai bị xóa, thư mục `nouri/recipes` trống. (Bước trả về dùng `PUT /:id` nên nguyên liệu được ghi lại, nội dung không đổi.)
  - Còn lại cho lượt 6: xóa EXIF (GPS) khỏi ảnh bài viết; `npm audit` có lỗ hổng sẵn từ trước ở axios, prisma, express/body-parser, zod (không do gói mới), chưa xử lý.
- [x] Lượt 6 — Ảnh trong bài viết:
  - Model `CommunityPostImage` (`postId`, `url`, `publicId`, `position`, xóa theo bài), migration `20261031030000_add_community_post_images`.
  - `POST /api/community` nhận JSON như cũ hoặc multipart (`content`, `recipeId`, `images` ≤ 4) qua `communityPostImagesUpload`; bài cần có chữ, công thức hoặc ảnh (kiểm tra trong service, 422). Có ảnh mà chưa cấu hình Cloudinary → 503; bài không ảnh vẫn đăng được.
  - Xóa EXIF bằng **sharp** (`services/image-sanitize.ts`): giải mã, `rotate()` theo tag Orientation (ảnh giữ đúng chiều), mã hóa lại cùng định dạng không kèm metadata (JPEG/WEBP chất lượng 90), chặn ảnh > 40 MP; ảnh hỏng → 422. Làm **trước** khi tải lên nên bản gốc trên Cloudinary không còn GPS.
  - Tải lần lượt vào `nouri/posts`; ảnh sau lỗi thì xóa các ảnh đã tải; tạo bài (nested create) lỗi thì xóa toàn bộ ảnh đã tải. `deleteCommunityPost` (Admin và "xóa bài của tôi") xóa ảnh Cloudinary sau khi transaction thành công (lỗi chỉ ghi log). Feed, bài vừa đăng và danh sách kiểm duyệt trả `images: [{ url, position }]`.
  - Frontend: nút "Ảnh" hiện lại (chọn nhiều, tối đa 4), xem trước + bỏ từng ảnh (`ComposerImagePreviews`), báo lỗi định dạng/dung lượng/số ảnh trước khi gửi (`addCommunityImages`), gửi multipart khi có ảnh; ảnh trong bài (`PostImages`) dùng `optimizedImageUrl` khổ thẻ.
  - Test: quá 4 ảnh, sai định dạng, quá 5 MB, bài chỉ có ảnh, JSON cũ vẫn chạy, tạo bài lỗi/ảnh sau lỗi thì xóa ảnh đã tải, xóa bài thì xóa ảnh, chưa cấu hình → 503 nhưng bài không ảnh vẫn đăng, ảnh gửi lên Cloudinary không còn EXIF/GPS và đã xoay đúng.
  - Đã kiểm tra trên Docker với Cloudinary thật (dữ liệu Docker đã chuyển sang ổ D:; sau mỗi lần build chạy `docker builder prune -f`): demo đăng bài qua giao diện kèm JPEG 1200×800 có GPS + tag xoay 6 và một PNG → 201 multipart; bản gốc tải từ Cloudinary không còn EXIF/XMP/GPS, ảnh 1 thành 800×1200 (đúng chiều); máy tính và điện thoại hiện bản `w_640`, không cuộn ngang; "xóa bài của tôi" (gọi API, chưa có giao diện) → 204, `nouri/posts` trống, URL ảnh (gốc và bản tối ưu) 404 sau khi CDN xóa cache. Đã dọn dữ liệu thử (33 món, 0 bài).
  - Đã sửa hàng nút ô đăng bài (`c83d837`): ≤ 480px cụm "Đăng bài" xuống hàng riêng, "Ảnh"/"Công thức" giữ chữ, vùng bấm 44px; nút "Ảnh" bỏ lề thừa của `.community-composer label`. Bằng chứng và ảnh so sánh trong `docs/test-evidence/README.md` (mục Giai đoạn 3).
- [x] Lượt 7 — Nhật ký thao tác Admin:
  - Migration `20261031040000_add_admin_audit_log`: model `AdminAuditLog` (`actorId` FK `Restrict`, `action`, `targetType`, `targetId` không FK để nhật ký còn sau khi đối tượng bị xóa, `targetLabel`, `details` JSON, `createdAt`; index theo thời gian, người thực hiện, đối tượng); enum `AdminAuditAction` (10 loại), `AdminAuditTargetType`.
  - `modules/admin/admin-audit.service.ts`: `recordAdminAction(tx | prisma, entry)` ghi trong **cùng transaction** với thao tác (thao tác lỗi thì không có nhật ký; ghi nhật ký lỗi thì thao tác bị hủy, ảnh vừa tải bị xóa). `details` theo danh sách trường cố định, không chép body request.
  - Ghi ở: tạo (`slug`), sửa (`changedFields` chỉ tên trường), ẩn/hiện, xóa, đổi ảnh món (`replacedUploadedImage`); khóa/mở khóa (nhãn = email); Admin xóa bài (`authorId`, số ảnh/bình luận/like, có công thức) và bình luận (`authorId`, `postId`). Ẩn lại/khóa lại không đổi trạng thái thì **không** ghi. "Xóa bài của tôi" không ghi nhật ký Admin.
  - Không lưu: mật khẩu/hash, token, nội dung bài/bình luận, publicId ảnh, giá trị trường món.
  - `GET /api/admin/audit-logs`: mới nhất trước, `page`, `pageSize` ≤ 50, lọc `action`, `targetType`, `targetId`, `actorId`; kèm người thực hiện (id, tên, email).
  - Sửa kèm: xóa hẳn món có ảnh đã tải lên thì xóa luôn ảnh trên Cloudinary (lỗi có từ lượt 5, trước đây ảnh bị bỏ lại).
  - Test: helper `src/test/fake-transaction.ts` kiểm tra lệnh ghi nhật ký đi qua `tx` hoặc nằm trong mảng `$transaction` (đã thử cố ý ghi ngoài transaction → test báo lỗi); phân quyền API mới; nội dung từng loại nhật ký; không ghi khi bị từ chối (422/409/404/400/403) hoặc không đổi trạng thái; ghi nhật ký lỗi → 500; không có mật khẩu/nội dung/publicId trong nhật ký.
  - Đã kiểm tra trên Docker (`docs/test-evidence/2026-10-31_gd3-l7_nhat-ky-admin.txt`): 10 thao tác → đúng 10 dòng, đúng thứ tự; USER 403; lọc/phân trang đúng; không chứa mật khẩu, token, nội dung, publicId; `nouri/recipes` trống sau khi xóa món có ảnh. Đã dọn dữ liệu thử (cả 10 dòng nhật ký).

**GĐ3 đã xong**: backend (lượt 1–7) và frontend Admin (UI-9, UI-10).

- [x] Upload ảnh Cloudinary (lượt 5).
- [x] Đăng ảnh trong bài viết (lượt 6): lưu URL ảnh vào bài viết, hiện lại nút "Ảnh".
- [x] Admin (backend): CRUD công thức, quản lý user (khóa/mở), kiểm duyệt community, thống kê, nhật ký thao tác (lượt 1–4, 7). Giao diện Admin: xem mục dưới.
  - Công thức: Admin thêm/sửa món và upload ảnh thật (thay ảnh tạm theo nhóm món của seed). Công thức **đã được dùng** thì chỉ **ẩn**, không xóa hẳn: cần trường đánh dấu ẩn (migration mới). Món chưa từng được dùng thì được xóa hẳn.
  - **Quy tắc chung cho món bị ẩn** (áp dụng cho cả thực đơn và bài viết cộng đồng):
    - "Đã được dùng" = có `MealPlanItem` **hoặc** `CommunityPost` tham chiếu (cả hai FK đều chặn xóa hẳn).
    - Vẫn xem được trang chi tiết `/recipes/:id` qua link trực tiếp, có thông báo "Món này đã ngừng sử dụng". Thực đơn cũ và bài viết cũ vẫn hiện món (bài viết: thẻ công thức kèm nhãn, **giữ** link tới `/recipes/:id`).
    - Không hiện trong danh sách công thức; không chọn được khi tạo thực đơn, đăng bài (ô chọn công thức + `assertAttachableRecipe`) hay thêm món thủ công.
    - Ẩn các nút "Chia sẻ lên cộng đồng" và "Thêm vào thực đơn" trên trang chi tiết của món bị ẩn.
  - Kiểm duyệt community: Admin xóa **bất kỳ** bài/bình luận vi phạm. Dùng chung service xóa bài với "Xóa bài của tôi" (GĐ5); chỉ khác điều kiện quyền (`requireAdmin` thay vì `authorId === userId`).
  - Khi Admin tạo/sửa món có nhãn `VEGETARIAN` hoặc `VEGAN`, backend kiểm tra nguyên liệu bằng logic trong `backend/src/services/dietary.service.ts` (cùng bộ từ khóa thịt/cá/hải sản và nhóm Sữa/Trứng như test dữ liệu seed) và **từ chối** (422) nếu có thành phần không hợp lệ với nhãn.
- [x] Route/page Admin ở frontend, guard theo role (gồm trang nhật ký thao tác dùng `GET /api/admin/audit-logs`). Khung, Thống kê, Công thức: UI-9; Người dùng, Kiểm duyệt, Nhật ký: UI-10.

### Giai đoạn 3b — Kho thông minh (8–10/11)
- [ ] Đánh dấu bữa "đã ăn" → trừ nguyên liệu trong kho theo số khẩu phần:
  - Màn hình xem trước cho chỉnh lượng trừ trước khi xác nhận.
  - Trừ món có hạn dùng sớm nhất trước; không trừ xuống dưới 0.
  - Quy đổi g ↔ kg, ml ↔ l; đơn vị không quy đổi được thì bỏ qua và báo.
  - Bỏ đánh dấu "đã ăn" thì hoàn lại đúng lượng đã trừ.
- [ ] Backend điền `ShoppingItem.category` khi tạo thực đơn (dùng chung cho nhóm danh sách đi chợ ở trang Thực đơn và cho bước "đã mua → thêm vào kho"); frontend bỏ phần đoán nhóm theo tên (`shoppingGroupOf` trong `meal-plans.logic.ts`) khi đã có `category`.
- [ ] Đánh dấu "đã mua" trong danh sách đi chợ → thêm vào kho (gộp với món cùng tên, cùng đơn vị nếu có).
- [ ] Bảng lịch sử xuất/nhập kho (nguồn: tiêu thụ, mua sắm, nhập tay, quét ảnh) để hoàn tác và hiển thị lịch sử.
- [ ] Thuật toán tạo thực đơn ưu tiên món dùng nguyên liệu sắp hết hạn.
- [ ] Trang Kho: nút "Gợi ý món" trên dòng sắp hết hạn (DESIGN.md mục 14; UI-5 chưa hiện). Trang Công thức: bộ lọc "Phù hợp với tôi" và nhãn cảnh báo trên thẻ món.

### Giai đoạn 3c — Quét hóa đơn (OCR) (11–14/11)
- [ ] Nút "Quét hóa đơn" nhận ảnh hóa đơn hoặc nhãn sản phẩm; OpenAI đọc ảnh với structured output; trả về tên, số lượng, đơn vị (thuộc `FoodUnit`), nhóm, hạn dùng nếu đọc được, nếu không thì gợi ý hạn ước tính theo nhóm.
- [ ] Màn hình xem lại bắt buộc: sửa/bỏ từng dòng trước khi thêm hàng loạt vào kho; ghi lịch sử kho nguồn "quét ảnh".
- [ ] Không lưu ảnh; giới hạn định dạng/dung lượng; không có `OPENAI_API_KEY` thì khóa nút và giải thích.
- [ ] Bước Tài liệu: kiểm thử trên ~10 hóa đơn thật, ghi tỷ lệ đọc đúng.

### Giai đoạn 4 — Bảo mật tài khoản
- [ ] Access token ngắn hạn + refresh token lưu DB, endpoint refresh/logout, interceptor tự refresh.
- [ ] Quên/đặt lại mật khẩu qua email (token reset có hạn, dùng 1 lần).
- [ ] Xử lý lỗ hổng `npm audit` (hiện có ở axios, prisma, express/body-parser, zod…): ưu tiên nâng bản vá/minor an toàn; bản major thì **báo người dùng trước** khi nâng. Nâng xong chạy lại toàn bộ test (backend, frontend) và build.

### Chỉnh UI các trang cũ
- Thay bằng mục "Làm lại toàn bộ giao diện" (31/10–7/11), làm trước GĐ4.

### Giai đoạn 5 — Nghiệp vụ bổ sung
- [x] ~~Tách dữ liệu tĩnh của Landing ra `features/landing/landing.data.ts`~~: làm trong UI-11 (Landing viết lại). (`MealPlansPage` đã tách vào `components/meal-plans/` khi làm lại giao diện ở UI-6.)
- [ ] Thêm món thủ công vào thực đơn (chọn recipe → gắn vào MealPlanDay/MealType, cập nhật shopping list). Có nút "Thêm vào thực đơn" ở trang chi tiết công thức (chỗ đã để sẵn từ GĐ2).
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
- [ ] Gom logic so khớp nguyên liệu/dị ứng của `mealPlanSuggestions` (`asWords` trong `features/meal-plans/meal-plans.logic.ts`) về backend, dùng chung `dietary.service.ts` / `recipe-fit.service.ts`.
- [ ] Ô chọn công thức khi đăng bài đang lọc ở frontend trên toàn bộ danh sách công thức; khi Admin thêm nhiều món thì chuyển sang tìm kiếm ở backend (có giới hạn số kết quả).
- [ ] Thay `window.confirm` bằng một hộp xác nhận dùng chung cho mọi thao tác xóa (Pantry, Meal Plans, bài viết): đã có `useConfirm()` (UI-1), thay dần khi làm lại từng trang (Kho: xong ở UI-5; Thực đơn: xong ở UI-6).

### Giai đoạn 6 — Tùy chọn
- [ ] Đăng nhập Google (OAuth).
- [x] ~~Tách toàn bộ `LandingPage` (1.612 dòng)~~: thay bằng việc viết lại ở UI-11 (`components/landing/`, không còn GSAP). Kế hoạch cũ: section vào `components/landing/` (`LandingHero`, `LandingFeatures`, `LandingRecipeCarousel`, `LandingPlanSection`, `LandingCommunity`, `LandingAbout`, `LandingFooter`), hook GSAP vào `features/landing/useLanding*.ts`; so ảnh trước/sau.

### Cuối cùng — Tài liệu
- [ ] Cập nhật `REPORT_NOURI.md`: bảng chức năng, thống kê, Use Case, ERD theo code mới.
- [ ] Ghi các chức năng đã gỡ vào "Hướng phát triển".
- [ ] Sửa lỗi định dạng bảng mục 6.2, 6.8, 6.10 (tiêu đề 9 cột nhưng dòng phân cách chỉ 8 cột).
- [ ] Mục 3: bổ sung route `*` (redirect về `/`) vào danh sách route.
- [ ] Hướng phát triển: người dùng tự tạo công thức riêng để chia sẻ.
- [ ] Hạn chế: dinh dưỡng của bộ món seed là **số liệu ước tính**, tham khảo *Bảng thành phần thực phẩm Việt Nam* (Viện Dinh dưỡng, NXB Y học, 2007).
- [ ] Hạn chế: so khớp dị ứng dựa trên tên nguyên liệu và bảng nhóm dị ứng cố định; nguyên liệu có thành phần ẩn (vd. nước tương có lúa mì) có thể không bị phát hiện.
- [ ] Hạn chế: ngày từ server (hạn sử dụng, ngày thực đơn) hiển thị theo múi giờ máy người dùng; ở múi giờ âm (vd. châu Mỹ) có thể lệch về ngày hôm trước.
- [ ] Hạn chế: Admin sửa một món đã có trong thực đơn cũ thì thực đơn cũ giữ calo đã lưu ở `MealPlanItem`, nhưng tên, ảnh và nguyên liệu hiển thị theo bản đã sửa.
- [ ] Hạn chế: kiểm tra nhãn chay/thuần chay dựa trên tên nguyên liệu và bộ từ khóa cố định (`dietary.service.ts`).
- [ ] Hạn chế: ảnh đã xóa (xóa bài, thay ảnh công thức) vẫn mở được qua link cũ khoảng 1 phút do bộ nhớ đệm CDN của Cloudinary, dù đã gọi xóa kèm `invalidate: true` (đã ghi ở `docs/test-evidence/README.md`).

## Lưu ý khi demo
- **Bắt buộc trước demo: upload ảnh thật cho 33 món** (Admin → ảnh công thức, Cloudinary). Chưa có ảnh thì mọi nơi hiện ô tên món, hero Tổng quan không có ảnh.
- Phải có `OPENAI_API_KEY` hợp lệ, nếu không meal plan/chat chạy fallback (không phải AI thật).
- Chuẩn bị tài khoản Admin và User mẫu bằng seed.
- Khi đã có `OPENAI_API_KEY`, phải **kiểm thử lại luồng AI** (kịch bản 2–5 trong `docs/test-evidence/README.md`: thực đơn ăn chay, thuần chay, dị ứng hải sản, 4 bữa/ngày) vì các lần thử hiện tại chạy nhánh fallback; kiểm tra thêm `reconcileAIPlan` có phải thay món nào không.

## Còn chờ người dùng xác nhận
- Hạn nộp/ngày bảo vệ (để cắt bớt từ giai đoạn 6 ngược lên nếu gấp).
- Đề cương có ghi cụ thể dịch vụ ngoài nào không (email, upload, OAuth, payment).
