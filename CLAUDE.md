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
5. **Tách component theo giai đoạn:** giai đoạn nào sửa trang nào thì **tách component của trang đó trước**, thành **một commit riêng** (không đổi hành vi/giao diện), có **so ảnh trước/sau** (máy tính + điện thoại, các trạng thái chính của trang) rồi mới làm chức năng mới. Lịch tách: Pantry (xong ở bước dọn code), Dashboard ở GĐ2c, Community ở GĐ2b, MealPlans ở GĐ5, Landing (dữ liệu tĩnh ra `features/landing/landing.data.ts`) ở GĐ5; tách toàn bộ Landing là việc tùy chọn ở cuối.
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

Biến môi trường mới phải thêm vào `backend/src/config/env.ts` (Zod) và `.env.example` (chỉ tên, không giá trị).

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
- [ ] (c) Khối "Dành cho bạn" trên trang chi tiết: số nguyên liệu đã có trong kho / tổng và nguyên liệu còn thiếu; % calo so với mục tiêu ngày; cảnh báo dị ứng/không thích (dùng lại logic backend).
  - Gợi ý công thức ở Dashboard theo hồ sơ, **dùng chung logic backend** (`dietary.service.ts`) với khối "Dành cho bạn": hiện `dashboard.service.ts` chỉ lấy 3 món đầu theo `createdAt`, không lọc chế độ ăn/dị ứng (người ăn chay có thể thấy "Phở bò"); dòng "Dùng nguyên liệu trong kho" luôn hiện dù không dựa vào kho; ảnh chưa dùng `imageUrl`. Khi làm thì gom luôn logic so khớp đang chép ở frontend (`asWords` trong `meal-plans.logic.ts`) về backend.
- [ ] (d) Tùy chọn: chỉnh số khẩu phần.

### Giai đoạn 2b — Đính kèm công thức vào bài viết
- [ ] Trước tiên: tách component `CommunityPage` vào `components/community/` (`PostComposer`, `PostCard`, `CommentForm`, `CommunitySidebar`), commit riêng, so ảnh trước/sau.
- [ ] Schema: `CommunityPost.recipeId` tùy chọn (FK tới `Recipe`), migration mới.
- [ ] API đăng bài nhận `recipeId` (validate tồn tại); feed trả kèm thông tin tóm tắt công thức.
- [ ] FE: hiện lại nút "Công thức", chọn công thức có sẵn; bài viết hiển thị thẻ công thức liên kết tới `/recipes/:id` (trang ở GĐ2).
- [ ] Chỉ gắn công thức có sẵn; người dùng tự tạo công thức → hướng phát triển.

### Giai đoạn 3 — Admin + upload ảnh
- [ ] Role + middleware + seed tài khoản Admin.
- [ ] Upload ảnh Cloudinary.
- [ ] Đăng ảnh trong bài viết (làm ngay sau hạ tầng upload): lưu URL ảnh vào bài viết, hiện lại nút "Ảnh".
- [ ] Admin: CRUD công thức, quản lý user (khóa/mở), kiểm duyệt community, thống kê.
  - Công thức: Admin thêm/sửa món và upload ảnh thật (thay ảnh tạm theo nhóm món của seed). Công thức **đã được dùng trong meal plan** (có `MealPlanItem` tham chiếu) thì chỉ **ẩn**, không xóa hẳn: cần trường đánh dấu ẩn (migration mới); món ẩn không hiện ở danh sách/tạo thực đơn mới nhưng thực đơn cũ vẫn hiển thị đúng. Món chưa từng được dùng thì được xóa hẳn.
  - Kiểm duyệt community: Admin xóa **bất kỳ** bài/bình luận vi phạm. Dùng chung service xóa bài với "Xóa bài của tôi" (GĐ5); chỉ khác điều kiện quyền (`requireAdmin` thay vì `authorId === userId`).
  - Khi Admin tạo/sửa món có nhãn `VEGETARIAN` hoặc `VEGAN`, backend kiểm tra nguyên liệu bằng logic trong `backend/src/services/dietary.service.ts` (cùng bộ từ khóa thịt/cá/hải sản và nhóm Sữa/Trứng như test dữ liệu seed) và **từ chối** (422) nếu có thành phần không hợp lệ với nhãn.
- [ ] Route/page Admin ở frontend, guard theo role.

### Giai đoạn 4 — Bảo mật tài khoản
- [ ] Access token ngắn hạn + refresh token lưu DB, endpoint refresh/logout, interceptor tự refresh.
- [ ] Quên/đặt lại mật khẩu qua email (token reset có hạn, dùng 1 lần).

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
- [ ] Gộp cảnh báo pantry về module Notifications (về mặt tổ chức code/tài liệu).

### Việc làm sau (chưa xếp giai đoạn)
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

## Lưu ý khi demo
- Phải có `OPENAI_API_KEY` hợp lệ, nếu không meal plan/chat chạy fallback (không phải AI thật).
- Chuẩn bị tài khoản Admin và User mẫu bằng seed.
- Khi đã có `OPENAI_API_KEY`, phải **kiểm thử lại luồng AI** (kịch bản 2–5 trong `docs/test-evidence/README.md`: thực đơn ăn chay, thuần chay, dị ứng hải sản, 4 bữa/ngày) vì các lần thử hiện tại chạy nhánh fallback; kiểm tra thêm `reconcileAIPlan` có phải thay món nào không.

## Còn chờ người dùng xác nhận
- Hạn nộp/ngày bảo vệ (để cắt bớt từ giai đoạn 6 ngược lên nếu gấp).
- Đề cương có ghi cụ thể dịch vụ ngoài nào không (email, upload, OAuth, payment).
