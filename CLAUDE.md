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
4. **CSS theo module:** `frontend/src/styles/NN-<module>.css` là các lớp giao diện tích lũy theo thời gian, **thứ tự import trong `styles.css` quyết định kết quả**. CSS mới viết vào file của module tương ứng hoặc file mới thêm ở **cuối** danh sách import; không thêm vào `01-base.css`. Không đổi thứ tự import hay gộp selector trùng nếu chưa so ảnh trước/sau.
5. **Tách component theo giai đoạn:** giai đoạn nào sửa trang nào thì **tách component của trang đó trước**, thành **một commit riêng** (không đổi hành vi/giao diện), có **so ảnh trước/sau** (máy tính + điện thoại, các trạng thái chính của trang) rồi mới làm chức năng mới. Lịch tách: Pantry (xong ở bước dọn code), Dashboard và RecipeDetail ở GĐ2c (xong), Community ở GĐ2b (xong), MealPlans ở GĐ5, Landing (dữ liệu tĩnh ra `features/landing/landing.data.ts`) ở GĐ5; tách toàn bộ Landing là việc tùy chọn ở cuối.
6. **Cấu trúc Admin (GĐ3):** frontend `pages/admin/*Page.tsx`, `components/admin/`, `features/admin/*.api.ts`, `layouts/AdminLayout.tsx`, route guard `AdminRoute`, CSS `styles/29-admin.css` (thêm cuối danh sách import). Backend `modules/admin/` dùng `requireAdmin`, gọi lại service sẵn có (công thức, service xóa bài dùng chung), không chép logic.

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
| Bookmark Landing | GĐ5: Guest bấm thì chuyển sang `/login` |
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
- [ ] Chốt hướng thiết kế UI dùng chung (màu, chữ, khoảng cách, thành phần dùng chung) trước khi làm trang Admin; ghi quyết định vào CLAUDE.md để các trang mới (Admin) và việc chỉnh trang cũ theo cùng một hướng.
  - **Phông chữ phải đủ tiếng Việt.** Khi đổi phông (ở bước này hoặc khi chỉnh UI), kiểm tra bằng Playwright các chữ có dấu chồng (ố, ặ, ữ, ỗ, ẫ, ợ) ở **mọi độ đậm đang dùng và chữ nghiêng**; khai báo phông dự phòng có tiếng Việt (Noto Serif cho chữ có chân, Noto Sans cho chữ không chân), không để rơi về Georgia. Lý do: Georgia không có chữ ghép sẵn như "ố" nên trình duyệt ghép "ô" + dấu rời và đặt lệch ("Sô ́ng"); đã sửa bằng Noto Serif ở nhánh `fix-landing-tieng-viet`. Test `source-nfc.test.ts` (frontend, backend) chỉ chặn dấu rời trong mã nguồn, không phát hiện lỗi phông.

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

**Backend GĐ3 đã xong** (lượt 1–7). Còn lại của GĐ3: chốt hướng thiết kế UI, rồi frontend Admin.

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
- [ ] Route/page Admin ở frontend, guard theo role (gồm trang nhật ký thao tác dùng `GET /api/admin/audit-logs`).

### Giai đoạn 4 — Bảo mật tài khoản
- [ ] Access token ngắn hạn + refresh token lưu DB, endpoint refresh/logout, interceptor tự refresh.
- [ ] Quên/đặt lại mật khẩu qua email (token reset có hạn, dùng 1 lần).
- [ ] Xử lý lỗ hổng `npm audit` (hiện có ở axios, prisma, express/body-parser, zod…): ưu tiên nâng bản vá/minor an toàn; bản major thì **báo người dùng trước** khi nâng. Nâng xong chạy lại toàn bộ test (backend, frontend) và build.

### Chỉnh UI các trang cũ (khoảng 20–23/11/2026)
- [ ] Chỉnh UI các trang cũ theo hướng thiết kế đã chốt. Mỗi trang: tách component trước (nếu chưa tách), commit riêng, so ảnh trước/sau trên máy tính và điện thoại.
- Vị trí trong lộ trình là ước tính theo ngày; điều chỉnh khi biết tiến độ GĐ3–GĐ4.

### Giai đoạn 5 — Nghiệp vụ bổ sung
- [ ] Trước tiên: tách component `MealPlansPage` vào `components/meal-plans/` (`MealPlanToolbar`, `MealDayTabs`, `MealColumn`, `WeekSummary`, `NutritionCard`, `SuggestionCard`, `ShoppingCard`); tách dữ liệu tĩnh của Landing ra `features/landing/landing.data.ts`. Mỗi việc một commit, so ảnh trước/sau.
- [ ] Thêm món thủ công vào thực đơn (chọn recipe → gắn vào MealPlanDay/MealType, cập nhật shopping list). Có nút "Thêm vào thực đơn" ở trang chi tiết công thức (chỗ đã để sẵn từ GĐ2).
- [ ] Lưu DB: favorite recipe, saved post, follow, lượng nước.
- [ ] Chủ đề/thành viên nổi bật từ dữ liệu thật.
- [ ] Xóa bài của tôi:
  - Endpoint `DELETE /api/community/:postId`.
  - Chỉ tác giả được xóa (so `authorId` với `userId` từ JWT); bài của người khác hoặc không tồn tại trả 404 (không lộ sự tồn tại).
  - Like/comment tự xóa nhờ `onDelete: Cascade` trong schema. `Notification` **không có FK** tới post (chỉ `relatedId` dạng chuỗi) → phải `deleteMany` notification `COMMUNITY_*` có `relatedId = postId` trong cùng transaction.
  - Service xóa dùng chung với Admin (GĐ3), tham số hóa điều kiện quyền.
  - FE: menu "Tùy chọn bài viết" chỉ hiện "Xóa bài" với bài của chính mình; có hộp xác nhận trước khi xóa.
  - Test ownership (xóa bài người khác bị từ chối, bài vẫn còn) và test xóa kèm notification.
- [ ] Menu "Tùy chọn bài viết": "Lưu bài" (SavedPost) + "Xóa bài của tôi".
- [ ] Bookmark Dashboard nối favorite recipe; bookmark Landing chuyển Guest sang `/login`; "Xem tất cả" thành viên nổi bật.
- [ ] Endpoint công thức công khai cho Landing; Landing dùng API thật.
  - Đã làm trước (nhánh `fix-landing-tieng-viet`): `GET /api/recipes/stats` công khai, chỉ trả số đếm (tổng, bữa sáng, món chay, thuần chay, ít tinh bột, giàu đạm); Landing hiện số thật theo nhóm, chưa tải được thì ẩn số; bỏ nhóm giả "Giảm cân", "Eat clean" và câu "Hàng ngàn công thức".
  - Còn lại GĐ5: carousel 4 món vẫn là dữ liệu tĩnh (đã khớp tên, thời gian, ảnh nhóm món với seed; ảnh qua `recipeImageSrc`); bấm nhóm chỉ đổi món nổi bật, chưa lọc món thật; số minh họa ở mục Cộng đồng ("2.340 thành viên", "20K+/5K+/15K+", "128" lượt thích) đã bỏ, thay bằng chữ; khi có số thật (GĐ5) có thể hiện lại.
- [ ] Gộp cảnh báo pantry về module Notifications (về mặt tổ chức code/tài liệu).

### Việc làm sau (chưa xếp giai đoạn)
- [ ] Gom logic so khớp nguyên liệu/dị ứng của `mealPlanSuggestions` (`asWords` trong `features/meal-plans/meal-plans.logic.ts`) về backend, dùng chung `dietary.service.ts` / `recipe-fit.service.ts`.
- [ ] Ô chọn công thức khi đăng bài đang lọc ở frontend trên toàn bộ danh sách công thức; khi Admin thêm nhiều món thì chuyển sang tìm kiếm ở backend (có giới hạn số kết quả).
- [ ] Thay `window.confirm` bằng một hộp xác nhận dùng chung cho mọi thao tác xóa (Pantry, Meal Plans, bài viết).

### Giai đoạn 6 — Tùy chọn
- [ ] Đăng nhập Google (OAuth).
- [ ] Tách toàn bộ `LandingPage` (1.612 dòng): section vào `components/landing/` (`LandingHero`, `LandingFeatures`, `LandingRecipeCarousel`, `LandingPlanSection`, `LandingCommunity`, `LandingAbout`, `LandingFooter`), hook GSAP vào `features/landing/useLanding*.ts`; so ảnh trước/sau.

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
- Phải có `OPENAI_API_KEY` hợp lệ, nếu không meal plan/chat chạy fallback (không phải AI thật).
- Chuẩn bị tài khoản Admin và User mẫu bằng seed.
- Khi đã có `OPENAI_API_KEY`, phải **kiểm thử lại luồng AI** (kịch bản 2–5 trong `docs/test-evidence/README.md`: thực đơn ăn chay, thuần chay, dị ứng hải sản, 4 bữa/ngày) vì các lần thử hiện tại chạy nhánh fallback; kiểm tra thêm `reconcileAIPlan` có phải thay món nào không.

## Còn chờ người dùng xác nhận
- Hạn nộp/ngày bảo vệ (để cắt bớt từ giai đoạn 6 ngược lên nếu gấp).
- Đề cương có ghi cụ thể dịch vụ ngoài nào không (email, upload, OAuth, payment).
