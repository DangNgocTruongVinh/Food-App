# Audit hardcode toàn dự án

> **Commit đã audit: `00e9cac`** (nhánh `main`, 14/11/2026). Chỉ đọc và thống kê, không sửa code. Số dòng đúng với commit này.
> Phạm vi: `backend/src`, `backend/scripts`, `backend/prisma` (schema, seed, demo), `frontend/src`, `docker-compose.yml`,
> `frontend/nginx.conf`, tài liệu `docs/`, `README.md`; **bỏ qua** file test, `node_modules`, `dist`.
> Cách làm: tìm có hệ thống bằng `git grep` (mật khẩu/khóa/email/URL, số kèm `_000`, mảng hằng, chuỗi giống nhau ở nhiều file,
> `mock`/`fake`/`Math.random`, `useQuery` trong component, Prisma trong controller), kiểm thêm **lịch sử git** để tìm bí mật đã từng
> commit, rồi mới đọc kỹ những chỗ trúng.

## Tóm tắt

| Nhóm | Ý nghĩa | Số mục | Rủi ro cao | Rủi ro vừa | Rủi ro thấp |
|---|---|---|---|---|---|
| A | Bắt buộc giữ (chỉ kiểm tên hằng, tài liệu) | 9 | 0 | 0 | 9 |
| B | Nên chuyển thành config / constants dùng chung | 8 | 0 | 3 | 5 |
| C | Nên chuyển vào Database | 4 | 0 | 1 | 3 |
| D | Mock / dữ liệu giả cần loại bỏ | 1 | 0 | 0 | 1 |
| E | Business logic cần tái cấu trúc | 5 | 0 | 3 | 2 |
| F | Bảo mật | 3 | 0 | 2 | 1 |
| **Tổng** | | **30** | **0** | **9** | **21** |

**Không có mục rủi ro cao.** Không tìm thấy khóa API, mật khẩu thật, chuỗi kết nối có mật khẩu hay email cá nhân trong mã/tài liệu đã
commit, kể cả trong lịch sử git (xem mục "Đã kiểm, không có vấn đề").

**5 mục rủi ro cao nhất (đều mức vừa):**
1. **F1** — Chưa cấu hình SMTP thì liên kết đặt lại mật khẩu bị ghi nguyên văn ra log, kể cả khi `NODE_ENV=production`.
2. **F2** — `docker-compose.yml` mở cổng PostgreSQL `5432` ra mọi địa chỉ mạng (backend thì chỉ nghe `127.0.0.1`).
3. **B6** — Giới hạn nhập liệu (hồ sơ, công thức thành viên, bài viết, ảnh 5 MB/4 ảnh, mật khẩu 8–72) khai báo riêng ở backend và
   frontend, không có test giữ khớp — lệch thì giao diện cho qua nhưng API trả 422 (hoặc ngược lại).
4. **E1** — Quy tắc "sắp hết hạn = còn ≤ 3 ngày" định nghĩa ở 4 nơi (3 hằng backend khác tên + 1 số `3` viết thẳng ở frontend).
5. **E2** — Giờ Việt Nam (UTC+7) viết lại ở 5 file dù đã có `utils/vietnam-date.ts`; có hai hàm `vietnamWeekStart` khác nhau
   (Thống kê Admin và Báo cáo).

---

## A. Bắt buộc giữ

Đều đã có tên hằng; cột "Đề xuất" chỉ nêu phần tài liệu còn thiếu.

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm A | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| backend/src/modules/recommendation/hybrid.ts:23–39 | `CONTEXT_WEIGHTS`, `COLD_START_KAPPA = 10`, `POPULARITY_WEIGHT0 = 0.3`, `MMR_LAMBDA = 0.8` | Hằng số thuật toán, chọn bằng đánh giá (thuat-toan-goi-y.md mục 7–8); đổi là sai số liệu | thấp | Giữ. Có tên, có chú thích, có tài liệu | — |
| recommendation/features.ts:11, interactions.ts:13–15, collaborative.ts:11–13, knowledge-based.ts:19–25 | `BLOCK_WEIGHTS`, ω 3/3/2/0,5, τ = 30, λ = 5, k = 20, `MIN_SUPPORT = 3`, α 0,35/0,25/0,2/0,1/0,1, `CALORIE_SIGMA = 0.35` | Hằng số thuật toán 1–3 đã ghi ở thuat-toan-goi-y.md mục 3–6 | thấp | Giữ | — |
| backend/src/modules/meal-plans/meal-plan-scorer.ts:27–31 | `CONTENT_WEIGHT = 0.3`, `REPEAT_WINDOW_DAYS = 3`, `WEEKLY_REPEAT_PENALTY = 0.1` | Hằng số bộ tạo thực đơn, đã ghi mục 9 | thấp | Giữ | — |
| backend/src/modules/meal-plans/meal-plan-generator.ts:53–56, 106 | `CROSS_DAY_PENALTY = 100`, `DIET_PREFERENCE_PENALTY = 15`, `WEEKLY_USE_PENALTY = 10`, `YESTERDAY_PENALTY = 3`, `MAX_INVALID_AI_MEAL_RATIO = 0.5` | Hằng số thuật toán của `fallbackPlan` / `reconcileAIPlan` | thấp | Có tên nhưng **chưa ghi trong tài liệu** → bổ sung 1 đoạn vào thuat-toan-goi-y.md mục 9 | S |
| backend/src/services/nutrition.service.ts:10–28 | Mifflin–St Jeor `10 * weight + 6.25 * height - 5 * age`, `+5` / `-161`, hệ số vận động 1,2–1,9, đạm 25%/30%, béo 28% | Công thức dinh dưỡng chuẩn | thấp | Giữ. `activityFactor` có tên; tỷ lệ đạm/béo là biến cục bộ, **chưa ghi nguồn** → thêm chú thích nguồn và 1 dòng tài liệu | S |
| backend/prisma/seed-data.ts, demo-account.ts, demo-history.ts, demo-report.ts, sample-accounts.ts | 33 món, kho mẫu, lịch sử mẫu, 8 tuần báo cáo mẫu, 8 tài khoản `mauN` (`isSample`) | Dữ liệu seed/demo có chủ đích, đã gắn nhãn "mẫu", không tính vào thống kê | thấp | Giữ | — |
| backend/src/modules/auth/auth.service.ts:14, password-reset.service.ts:14, refresh-token.service.ts:18, notifications/expiry-email.service.ts:15, ai/chat-context.ts:88–92 | `ACCESS_TOKEN_TTL = "15m"`, `RESET_TOKEN_TTL_MINUTES = 30`, `REUSE_GRACE_MS = 10_000`, `TEST_SENDS_PER_DAY = 3`, `CHAT_HISTORY_TURNS = 6`… | Chính sách bảo mật/sản phẩm đã chốt, ghi ở test-evidence/bao-mat.md và CLAUDE.md | thấp | Giữ (không nên để người vận hành đổi tùy tiện) | — |
| frontend/src/features/landing/landing.data.ts:65–74 | `HERO_MEAL_PLAN`: Bánh mì ốp la 410 kcal, Bún chả 640, Canh chua cá lóc 470 | Mockup minh họa giao diện trên trang chủ, chú thích ghi rõ "lấy từ seed-data.ts, không phải số liệu quảng cáo" | thấp | Giữ. Nếu Admin sửa calo các món này thì số trên mockup lệch — chấp nhận được | — |
| frontend/src/** (chuỗi tiếng Việt) | Nhãn, thông báo lỗi, câu hướng dẫn | Chuỗi giao diện, có test `design-rules.test.ts` | thấp | Giữ | — |

## B. Nên chuyển thành config hoặc constants dùng chung

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm B | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| backend/src/modules/community/community-member-recipe.ts:8 ↔ frontend/src/features/community/member-recipe.logic.ts:6; backend/src/modules/profile/profile.schema.ts:14–16 ↔ frontend/src/features/profile/profile.logic.ts:5–13; backend/src/modules/community/community.schema.ts:19 ↔ frontend/src/features/community/community.logic.ts:6; backend/src/services/image-file.ts:4–5 ↔ frontend/src/features/community/community.logic.ts:73–74, frontend/src/features/pantry/receipt-scan.logic.ts:9; backend/src/modules/auth/auth.schema.ts:3 ↔ frontend/src/features/auth/auth.logic.ts:20–21, 39–40, 63 (**B6**) | `MEMBER_RECIPE_LIMITS`, giới hạn hồ sơ 30/30/20/60 ký tự, bài viết 2000 ký tự, ảnh `5 * 1024 * 1024` / 4 ảnh, mật khẩu `min(8).max(72)` | Cùng giá trị khai báo ở hai phía, chỉ có chú thích "frontend giữ cùng số"; hiện đang khớp | **vừa** | Một file hằng dùng chung (bản gốc ở backend, frontend chép y nguyên, test so hai file — cách đã dùng cho `allergy-groups.ts`, `recipe-search.ts`) | M |
| backend/src/services/food-category.ts:4 ↔ frontend/src/utils/food-categories.ts:2 (**B7**) | 8 nhóm thực phẩm `["Rau củ", "Thịt & cá", …]` | Danh sách nghiệp vụ ở hai phía, không có test giữ khớp; lệch thì lọc Kho/đi chợ sai nhóm | **vừa** | Đưa vào file hằng dùng chung ở B6 | S |
| backend/src/modules/ai/openai.service.ts:14 ↔ frontend/nginx.conf (`proxy_read_timeout 180s`) (**B5**) | `MEAL_PLAN_TIMEOUT_MS = 120_000` | Hai giá trị phụ thuộc nhau ở hai file (đã từng gây lỗi 504); không có kiểm tra | **vừa** | Thêm test đọc `nginx.conf` kiểm `proxy_read_timeout` > `MEAL_PLAN_TIMEOUT_MS` | S |
| frontend/src/components/admin/AdminRecipeImageField.tsx:55, frontend/src/components/pantry/ReceiptScanPicker.tsx:51, frontend/src/features/landing/landing.data.ts:57, frontend/src/components/community/PostComposer.tsx:37 | Chữ "tối đa 5 MB", "tối đa 4 ảnh", "2000 ký tự" viết thẳng trong chuỗi | Chuỗi giao diện lặp lại giá trị giới hạn | thấp | Lấy số từ hằng ở B6 khi làm B6 | S |
| backend/src/modules/ai/recipe-estimate.ts:44 | `timeout: 45_000` | Thời gian chờ không có tên (các chỗ khác đều có tên) | thấp | Đặt tên hằng (vd. dùng chung `CHAT_TIMEOUT_MS`) | S |
| backend/src/modules/community/community-ai-review.ts:45 | `model: "omni-moderation-latest"` | Tên model AI cứng (các model khác đọc từ `.env`) | thấp | Biến `.env` tùy chọn `OPENAI_MODERATION_MODEL` (mặc định giữ nguyên) | S |
| backend/src/modules/auth/auth.routes.ts:18, 22–24; notifications/expiry-email.routes.ts:19; suggestions/suggestions.routes.ts:18–19 | `rateLimit({ windowMs: 60_000, max: 20 })`, `3_600_000 / 5`, `60_000 / 120` | Giới hạn lượt phụ thuộc triển khai, viết thẳng trong file route | thấp | Giữ trong code (là chính sách bảo mật), chỉ đưa thành hằng có tên ở đầu file | S |
| 12 file backend (vd. recipe-fit.service.ts:9, knowledge-based.ts:26, reports.logic.ts:6, refresh-token.service.ts:14…) | `const DAY_MS = 86_400_000` | Cùng một hằng khai báo lại 12 lần | thấp | Gom vào `backend/src/utils/vietnam-date.ts` (làm cùng E2) | S |

## C. Nên chuyển vào Database

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm C (lợi / hại) | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| backend/src/services/allergy-groups.ts:33 (`ALLERGY_GROUPS`, `PROCESSED_FOOD_TERMS`) | 11 nhóm dị ứng, tên gọi khác, nguyên liệu, "có thể chứa", ngoại lệ | **Lợi:** Admin thêm nguyên liệu chế biến mới (nước sốt lạ) không cần sửa code. **Hại:** mất test so hai bản backend/frontend, mất ma trận an toàn kiểm theo danh mục cố định; sửa sai một dòng là lọt dị ứng; phải thêm màn Admin + nhật ký + kiểm duyệt | **vừa** | Giữ trong code tới khi bảo vệ (an toàn quan trọng hơn tiện lợi) → hướng phát triển | L |
| backend/src/services/pantry-purchase.ts:23–33 | Hạn gợi ý theo nhóm (`DRY_LEGUME 90 ngày`, `FRESH_GRAIN 2 ngày`, `BREAD 2 ngày`…) | **Lợi:** Admin chỉnh hạn mặc định theo thực tế. **Hại:** thêm bảng, màn Admin; giá trị chỉ là gợi ý, người dùng vẫn sửa được | thấp | Hướng phát triển | M |
| backend/src/services/receipt/receipt-aliases.ts:4 | `RECEIPT_ALIASES` (tên viết tắt trên hóa đơn → tên thực phẩm) | **Lợi:** thêm cách viết tắt mới của siêu thị không cần deploy. **Hại:** ảnh hưởng `eval:receipt`; cần màn Admin | thấp | Hướng phát triển | M |
| backend/prisma/seed-data.ts:15, frontend/src/features/admin/admin-recipes.logic.ts:17, frontend/src/features/profile/profile.logic.ts:30 | Danh sách ẩm thực `["Việt Nam", "Nhật Bản", "Hàn Quốc", …]` (3 bản giống nhau) | **Lợi:** lấy từ các giá trị `Recipe.cuisine` đang có thì Admin thêm món ẩm thực mới là ô gợi ý Hồ sơ tự có. **Hại:** thêm 1 truy vấn/endpoint; ô Admin vẫn cho gõ tự do nên hiện không sai | thấp | Hướng phát triển (hiện chỉ là gợi ý, không chặn nhập) | S |

## D. Mock / dữ liệu giả

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm D | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| frontend/src/features/dashboard/dashboard.logic.ts:154, frontend/src/components/dashboard/WaterTracker.tsx:12 | Lượng nước: 8 ly, "2 lít" cố định, chỉ đếm trong lần xem (không lưu) | Chức năng chỉ ở giao diện, số không phải dữ liệu thật của người dùng (đã ghi ở docs/han-che.md) | thấp | Giữ, đã ghi hạn chế; lưu DB → hướng phát triển | M |

## E. Business logic cần tái cấu trúc

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm E | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| backend/src/services/recipe-fit.service.ts:11 (`PANTRY_EXPIRING_WINDOW_DAYS = 3`), backend/src/modules/notifications/notifications.service.ts:7 (`EXPIRY_WINDOW_DAYS = 3`), backend/src/modules/ai/chat-context.ts:92 (`EXPIRING_SOON_DAYS = 3`), frontend/src/features/pantry/pantry.logic.ts:60 (`days <= 3`) (**E1**) | "Sắp hết hạn = còn ≤ 3 ngày" | Một quy tắc nghiệp vụ, 4 định nghĩa; đổi một chỗ thì nhãn Kho, thông báo, gợi ý, trợ lý AI lệch nhau | **vừa** | Một hằng duy nhất ở backend (giữ `PANTRY_EXPIRING_WINDOW_DAYS`), các nơi khác import; frontend lấy từ file hằng dùng chung (B6) | S |
| backend/src/modules/admin/admin-stats.logic.ts:3, 8; backend/src/modules/ai/chat-context.ts:6, 51; backend/src/modules/reports/reports.logic.ts:7, 13, 30; backend/src/modules/ai/chat.service.ts:54; backend/src/modules/receipt-scan/receipt-scan.service.ts:33 — đã có backend/src/utils/vietnam-date.ts:2 (**E2**) | `VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000` (3 lần), `7 * 3_600_000` (2 lần), hai hàm `vietnamWeekStart` trả kiểu khác nhau | Quy tắc "ngày/tuần theo giờ Việt Nam" viết lại 5 nơi; hai định nghĩa đầu tuần có thể lệch | **vừa** | Gom vào `utils/vietnam-date.ts`: `VIETNAM_OFFSET_MS`, `vietnamDayStart`, `vietnamDateKey`, `vietnamWeekStart`; giữ test hiện có của từng module | M |
| backend/src/modules/ai/recipe-estimate.ts:38, backend/src/modules/community/community-ai-review.ts:53, backend/src/services/receipt/providers/openai-vision-provider.ts:86 (**E3**) | `model.startsWith("gpt-5") ? { reasoning: { effort: … } } : {}` | Quy tắc "model nào nhận tham số reasoning" lặp 3 nơi; đổi họ model thì phải sửa 3 chỗ | **vừa** | Một hàm `reasoningOption(model, effort)` trong `modules/ai/openai.service.ts` | S |
| backend/src/services/dietary.service.ts:13; backend/src/services/recipe-search.ts:22, 27; backend/src/services/allergy-groups.ts:132, 137; backend/src/services/receipt/receipt-text.ts:5; frontend/src/features/ui/combobox.logic.ts:23 | 5 hàm chuẩn hóa chữ (giữ dấu / bỏ dấu, có/không bỏ dấu câu) | Gần giống nhau nhưng **cố ý khác nghĩa** (dị ứng giữ dấu "cá" ≠ "cà"; tìm kiếm bỏ dấu khi gõ không dấu; combobox giữ độ dài để in đậm) | thấp | Không gộp trước bảo vệ: gộp làm đổi kết quả so khớp (ảnh hưởng ma trận an toàn, `eval:recommend`, `eval:receipt`). Chỉ thêm chú thích chéo giải thích vì sao khác → hướng phát triển | L |
| frontend/src/components/meal-plans/AddMealDialog.tsx, AddToPlanDialog.tsx, ConsumeMealDialog.tsx, notifications/NotificationCenter.tsx, pantry/PantryHistory.tsx, PantryItemDialog.tsx, PantrySide.tsx, ReceiptReview.tsx, ReceiptScanDialog.tsx, recipes/RecipeSuggestions.tsx | `useQuery(` / `useMutation(` trong component | Lệch quy ước "trang gọi query/mutation, component chỉ hiển thị" (hộp thoại tự tải dữ liệu) | thấp | Hướng phát triển: chuyển lên trang hoặc hook `features/<module>/use*.ts`; không đổi hành vi | M |

## F. Bảo mật

| file:dòng | Giá trị / đoạn ngắn | Vì sao nhóm F | Rủi ro | Đề xuất | Công sức |
|---|---|---|---|---|---|
| backend/src/services/email.service.ts:37–40 (**F1**) | `console.info(\`[email chưa cấu hình] Tới: … \n${message.text}\`)` | Chưa có SMTP thì ghi cả nội dung thư — gồm **liên kết đặt lại mật khẩu (token còn hiệu lực 30 phút)** và email người dùng — ra log, không phân biệt `NODE_ENV`. Ai đọc được log container là đổi được mật khẩu người khác | **vừa** | Production (`NODE_ENV=production`): chỉ ghi "Tới, Tiêu đề", bỏ nội dung; dev giữ như cũ. Thêm test | S |
| docker-compose.yml:10 (**F2**) | `ports: - "5432:5432"` | PostgreSQL nghe trên mọi địa chỉ mạng của máy chạy demo (mạng LAN/Wi-Fi trường) — chỉ còn mật khẩu `POSTGRES_PASSWORD` bảo vệ; backend đã giới hạn `127.0.0.1:4000` | **vừa** | Đổi thành `"127.0.0.1:5432:5432"` (máy dev vẫn kết nối được); ghi README | S |
| backend/prisma/demo-account.ts:15, README.md:71 | `DEMO_PASSWORD = "Demo@123"` | Mật khẩu tài khoản demo trong mã và README | thấp | Giữ: tài khoản demo có chủ đích, quyền USER, `demo:reset` đặt lại; nếu đưa lên mạng công khai thì đổi bằng biến `.env` hoặc tắt tài khoản demo → ghi trong README phần triển khai | S |

## Đã kiểm, không có vấn đề

- Không có `.env`, khóa (`sk-…`, `AKIA…`, `-----BEGIN`), chuỗi `postgresql://user:mật-khẩu@` hay `cloudinary://` trong cây mã **và cả lịch sử git**
  (`git log --all -p`); `.env.example` chỉ có tên biến.
- Tài khoản Admin chỉ tạo từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`backend/src/config/seed-env.ts`); `JWT_SECRET` bắt buộc ≥ 32 ký tự, không có giá trị
  mặc định (`backend/src/config/env.ts:12`); docker-compose dừng nếu thiếu `POSTGRES_PASSWORD`, `JWT_SECRET`.
- Ảnh hóa đơn thật không được commit (`.gitignore`, chỉ có `README.md` và mẫu đáp án trong `docs/test-evidence/receipts/`).
- Email thật chỉ xuất hiện trong file test (bỏ qua theo phạm vi); không có đường dẫn máy cá nhân, IP nội bộ trong mã/tài liệu.
- URL ứng dụng trong email lấy từ `FRONTEND_URL` (`password-reset.service.ts:33`, `expiry-email.service.ts:22`); tên model chính đọc từ
  `.env` (`OPENAI_MODEL`, `OPENAI_VISION_MODEL`).
- `MockProvider` (`backend/src/services/receipt/providers/mock-provider.ts`) chỉ dùng trong `scripts/eval-receipt-ocr.ts`; API chỉ nhận
  `"auto" | "tesseract" | "openai"` (`receipt-scan.schema.ts:14`) → không lọt vào luồng thật.
- Không có truy vấn Prisma trong controller/route; không có số liệu quảng cáo giả trên giao diện (đã gỡ từ UI-11).

---

## Kế hoạch refactor (chỉ B, D, E, F mức vừa) — chờ duyệt

Ba lượt nhỏ, mỗi lượt một nhánh, không đổi giá trị nào (chỉ gom chỗ khai báo), trừ F1 và F2.

### Lượt 1 — Bảo mật và vận hành (F1, F2, B5, E3)

- **File:** `backend/src/services/email.service.ts` (+ `email.service.test.ts`), `docker-compose.yml`, `README.md`,
  `backend/src/modules/ai/openai.service.ts`, `recipe-estimate.ts`, `community/community-ai-review.ts`,
  `services/receipt/providers/openai-vision-provider.ts`, test mới đọc `frontend/nginx.conf`.
- **Phụ thuộc:** không.
- **Rủi ro:** F1 đổi log ở production (dev giữ nguyên); F2: ai đang kết nối DB từ máy khác trong LAN sẽ mất kết nối (máy dev
  `localhost` vẫn được). Không đổi API, giao diện, số liệu đánh giá.
- **Kiểm thử:** toàn bộ test + typecheck + build; test mới "production không ghi nội dung thư", "nginx chờ lâu hơn timeout AI";
  `docker compose up -d --build`, `/api/health`; bấm thử "Quên mật khẩu" khi chưa có SMTP và xem `docker compose logs backend`
  (không còn liên kết); tạo thực đơn "Tạo bằng AI", kiểm duyệt bài cộng đồng, quét hóa đơn chế độ AI.

### Lượt 2 — Hằng số dùng chung backend–frontend (B6, B7, B-chữ "5 MB/4 ảnh", E1 phía frontend)

- **File:** mới `backend/src/shared/limits.ts` (bản gốc) + `frontend/src/features/shared/limits.ts` (bản chép) + test so hai file;
  sửa import ở `community-member-recipe.ts`, `member-recipe.logic.ts`, `profile.schema.ts`, `profile.logic.ts`, `community.schema.ts`,
  `community.logic.ts`, `image-file.ts`, `receipt-scan.logic.ts`, `auth.schema.ts`, `auth.logic.ts`, `food-category.ts`,
  `utils/food-categories.ts`, `pantry.logic.ts`, các component có chữ "5 MB/4 ảnh".
- **Phụ thuộc:** không (làm sau lượt 1 cho gọn nhánh).
- **Rủi ro:** thấp — giữ nguyên mọi giá trị nên không đổi API, giao diện, số liệu đánh giá; chỉ lo import sai đường dẫn.
- **Kiểm thử:** toàn bộ test + typecheck + build; test so hai file; bấm thử: Hồ sơ thêm 30 dị ứng (mục 31 bị chặn ở cả giao diện
  và API), đăng bài 5 ảnh / ảnh 6 MB, mật khẩu 7 ký tự, công thức thành viên 31 nguyên liệu, lọc Kho theo nhóm, nhãn "sắp hết hạn".

### Lượt 3 — Quy tắc thời gian (E1 phía backend, E2, B `DAY_MS`)

- **File:** `backend/src/utils/vietnam-date.ts` (thêm `VIETNAM_OFFSET_MS`, `DAY_MS`, `vietnamDayStart`, `vietnamDateKey`,
  `vietnamWeekStart`), sửa `admin-stats.logic.ts`, `chat-context.ts`, `chat.service.ts`, `reports.logic.ts`, `reports.service.ts`,
  `receipt-scan.service.ts`, `notifications.service.ts` (dùng `PANTRY_EXPIRING_WINDOW_DAYS`), 12 file khai báo `DAY_MS`.
- **Phụ thuộc:** lượt 2 (frontend dùng hằng "sắp hết hạn" từ file chung).
- **Rủi ro:** vừa — đụng `knowledge-based.ts`, `recipe-fit.service.ts`, `meal-plan-scorer.ts` (chỉ đổi chỗ import `DAY_MS`, không đổi
  giá trị) nên phải chứng minh số liệu đánh giá không đổi; đầu tuần Báo cáo và Thống kê Admin phải giữ Thứ Hai 00:00 giờ VN.
- **Kiểm thử:** toàn bộ test + typecheck + build; `npm run eval:recommend -w backend` và `npm run eval:mealplan -w backend` phải sinh
  **đúng bảng số cũ** (`git diff docs/thuat-toan-goi-y.md` rỗng); `npm run test:perf -w backend`; không đổi DB (không migration);
  bấm thử: Báo cáo tuần này/tuần trước, Thống kê Admin 12 tuần, thông báo sắp hết hạn, "Gửi thử ngay" email nhắc hạn, giới hạn
  câu hỏi trợ lý AI/lượt quét hóa đơn trong ngày.

## Hướng phát triển (đề xuất KHÔNG làm trước 2/12)

| Mục | Lý do để sau |
|---|---|
| C — danh mục nhóm dị ứng vào DB | Đụng an toàn thực phẩm: mất kiểm chứng bằng test/ma trận an toàn với danh mục cố định, cần màn Admin + nhật ký + kiểm duyệt; công sức L |
| C — hạn gợi ý theo nhóm, tên viết tắt hóa đơn, danh sách ẩm thực vào DB | Chỉ là gợi ý (người dùng vẫn sửa được); cần màn Admin; đổi `eval:receipt` |
| E — gộp 5 hàm chuẩn hóa chữ | Các hàm cố ý khác nghĩa; gộp đổi kết quả so khớp, ảnh hưởng ma trận an toàn và số liệu đánh giá; công sức L |
| E — chuyển `useQuery` khỏi 10 component | Chỉ là quy ước tổ chức, không lỗi người dùng thấy; đụng nhiều màn, cần so ảnh trước/sau |
| D — lưu lượng nước theo ngày | Chức năng mới (cần migration, API), trái quy tắc đóng băng; đã ghi hạn chế |
| B — giới hạn lượt, tên model kiểm duyệt ra `.env` | Rủi ro thấp; giá trị hiện tại là chính sách đã chốt, không cần đổi theo môi trường khi demo |
| A — bổ sung tài liệu bộ phạt `fallbackPlan`, nguồn tỷ lệ đạm/béo | Chỉ là tài liệu, có thể làm cùng bước "Tài liệu" cuối, không cần lượt refactor |
