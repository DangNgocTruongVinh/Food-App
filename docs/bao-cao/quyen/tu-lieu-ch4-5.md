# Tư liệu cho Chương 4–5

Thu thập ngày **17/11/2026** (bắt đầu 10:44 giờ Việt Nam), nhánh `tu-lieu-ch4-5` tách từ `main` ở commit **`aa5e875`**. Không sửa mã
nguồn; không đọc hay in nội dung `.env` (chỉ kiểm tên biến). Mọi số dưới đây là *đo thật* trên máy dev, trừ chỗ ghi *mô phỏng*.

## 1. Môi trường

| Thành phần | Phiên bản |
|---|---|
| Hệ điều hành | Windows 11 Home, `Microsoft Windows [Version 10.0.26200.9974]` |
| Node.js / npm | v22.14.0 / 10.9.2 (máy dev, dùng chạy test và script) |
| Docker / Compose | Docker 28.0.4 (build b8034c0), Docker Compose v2.34.0-desktop.1 |
| Container | `postgres:16-alpine`, backend `node:22-alpine`, frontend `nginx:1.27-alpine` (theo `docker-compose.yml`, `docs/bao-cao/kien-truc.md`) |
| Trình duyệt chụp ảnh | `playwright-core` 1.52.0, Chromium bản `chromium-1169` (headless) |

## 2. Kết quả bước 1 — kiểm thử tự động

| Lệnh | Mã thoát | Tệp test | Ca test | Thời gian Vitest | Thời gian cả lệnh |
|---|---|---|---|---|---|
| `npm test -w backend` | 0 | 73 đạt / 73 | 1.395 đạt / 1.395, 0 lỗi | 85,15 s | 95 s |
| `npm test -w frontend` | 0 | 38 đạt / 38 | 522 đạt / 522, 0 lỗi | 37,23 s | 41 s |
| `npm run test:perf -w backend` | 0 | 2 đạt / 2 | 2 đạt / 2 | 3,10 s | 6 s |

- Tổng: 111 tệp, 1.917 ca, tất cả đạt; khớp `docs/bao-cao/so-lieu.md` mục 1. Backend không còn lỗi `Timeout calling "onTaskUpdate"` (đã
  sửa ngày 16/11).
- `test:perf`: hai bài đo đều đạt ngưỡng. `recommendation.perf.test.ts` ("answers in < 150 ms: 33 recipes, and 500 recipes × 1,000 users in
  memory") chạy cả bài 1.197 ms; `collaborative.perf.test.ts` (dựng mô hình 500 món × 1.000 người × 20 tương tác) 311 ms. Bài đo không in
  thời gian của từng lần gợi ý, nên lần này **không có** số ms mỗi lượt gợi ý mới; số trong `so-lieu.md` (33 món 3–6,5 ms; 500 × 1.000 là
  90–117 ms) là lần đo 15/11.

## 3. Kết quả bước 2 — đánh giá mô phỏng

| Lệnh | Mã thoát | Thời gian cả lệnh | Thời gian script ghi |
|---|---|---|---|
| `npm run eval:recommend -w backend` | 0 | 21 s | 18,9 s |
| `npm run eval:mealplan -w backend` | 0 | 17 s | 14,5 s |

So với `docs/bao-cao/so-lieu.md` mục 2–3 (*dữ liệu mô phỏng*):

- **Gợi ý (bảng 1–5): mọi số giống hệt**, kể cả dòng xác nhận cấu hình đang chạy (0,45/0,30/0,25, w_pop0 = 0,4). Chỉ khác dòng "Mã ở
  commit `aa5e875`, chạy ngày 17/11/2026" và thời gian chạy (19.8 s → 18.9 s).
- **Thực đơn: mọi chỉ số chất lượng giống hệt** (lệch calo, ngày lệch ≤ 10%, đồ sắp hết hạn, bữa lặp, số món, vi phạm, bữa lấy món khác
  loại, 6/500 thực đơn OpenAI giả lập hỏng). Khác ở cột thời gian đo trên máy (dao động theo máy, không phải kết quả thuật toán):

  | Phương pháp | "Thời gian / thực đơn" trong `so-lieu.md` (15/11) | Lần chạy 17/11 |
  |---|---|---|
  | Bộ tạo cũ (fallbackPlan) | 0,6 ms | 0,5 ms |
  | Bộ tạo mới, không có khoảng calo | 11,2 ms | 11,7 ms |
  | Bộ tạo mới (scoredPlan) | 8,4 ms | 8,6 ms |
  | OpenAI giả lập → reconcileAIPlan | 1,1 ms | 1,2 ms |

  Thời gian chạy cả script: 14.3 s → 14.5 s.
- Theo yêu cầu, vì có số khác (cột thời gian), `docs/thuat-toan-goi-y.md` **giữ bản vừa sinh** (commit `aa5e875`, 17/11); `so-lieu.md`
  **không sửa**, nên cột "Thời gian / thực đơn" và dòng commit của hai tệp hiện lệch nhau.

## 4. Docker và dữ liệu demo

- `docker compose up -d --build`: mã thoát 0, 83 s; 3 container chạy, `postgres` healthy. Backend báo "26 migrations found … No pending
  migrations to apply" và lịch nhắc hạn 07:00; `GET /api/health` trả `{"status":"ok","service":"nouri-api","email":{"configured":true}}`.
- Trước `demo:reset`, tài khoản demo có dữ liệu tạo sau lần reset 12/11: thực phẩm "đậu phụ" thêm tay (13/11), 2 lượt quét hóa đơn chưa lưu
  (14/11), hồ sơ sửa (14/11). Đã hỏi và được đồng ý trước khi reset.
- `docker compose exec backend npm run demo:reset -- --yes`: mã thoát 0. Đã xóa: notifications 7, pantryTransactions 57, receiptScans 2,
  favoriteRecipes 2, mealPlans 2, likes 3 (các mục còn lại bằng 0); dựng lại 8 tài khoản mẫu, 8 bài viết, 14 lượt thích; lịch sử mẫu của demo
  12 bữa đã ăn, 3 lượt thích; báo cáo mẫu 56 dòng lịch sử kho (8 tuần), 12 bữa đã ăn (6 ngày qua). Đây là **dữ liệu mẫu**.
- Sau khi chụp ảnh: hồ sơ demo giữ nguyên (dị ứng rỗng, món không thích "Cần tây"); không có thay đổi kho; còn **1 lượt quét hóa đơn chưa
  lưu** (trạng thái READY) do ảnh 53.

## 5. Ảnh màn hình

Thư mục `docs/bao-cao/anh-man-hinh/` có 35 tệp WebP cho 34 màn hình (ảnh 30 cắt làm 2 phần). Cách chụp và trạng thái của các ảnh mới: xem
`README.md` trong thư mục đó.

| Tệp | Màn hình | Đường dẫn | Rộng |
|---|---|---|---|
| [01-trang-chu.webp](../anh-man-hinh/01-trang-chu.webp) | Trang chủ (khách) | `/` | 1440px |
| [02-dang-nhap.webp](../anh-man-hinh/02-dang-nhap.webp) | Đăng nhập | `/login` | 1440px |
| [03-dang-ky.webp](../anh-man-hinh/03-dang-ky.webp) | Đăng ký | `/login?mode=register` | 1440px |
| [04-quen-mat-khau.webp](../anh-man-hinh/04-quen-mat-khau.webp) | Quên mật khẩu | `/forgot-password` | 1440px |
| [10-tong-quan.webp](../anh-man-hinh/10-tong-quan.webp) | Tổng quan | `/dashboard` | 1440px |
| [11-kho.webp](../anh-man-hinh/11-kho.webp) | Kho thực phẩm | `/pantry` | 1440px |
| [12-kho-lich-su.webp](../anh-man-hinh/12-kho-lich-su.webp) | Kho: lịch sử thay đổi | `/pantry` | 1440px |
| [13-quet-hoa-don.webp](../anh-man-hinh/13-quet-hoa-don.webp) | Quét hóa đơn (chọn ảnh, chế độ đọc) | `/pantry?scan=1` | 1440px |
| [14-thuc-don.webp](../anh-man-hinh/14-thuc-don.webp) | Thực đơn (thực đơn mẫu đã ăn) | `/meal-plans` | 1440px |
| [15-cong-thuc.webp](../anh-man-hinh/15-cong-thuc.webp) | Công thức (Dành cho bạn, tất cả công thức) | `/recipes` | 1440px |
| [16-tim-kiem.webp](../anh-man-hinh/16-tim-kiem.webp) | Tìm kiếm công thức không dấu ("com tron") | `/recipes` | 1440px |
| [17-chi-tiet-mon.webp](../anh-man-hinh/17-chi-tiet-mon.webp) | Chi tiết công thức | `/recipes/cmvtmoifp00chmx4n0jlh9iif` | 1440px |
| [18-mon-yeu-thich.webp](../anh-man-hinh/18-mon-yeu-thich.webp) | Món yêu thích | `/recipes/favorites` | 1440px |
| [19-cong-dong.webp](../anh-man-hinh/19-cong-dong.webp) | Cộng đồng | `/community` | 1440px |
| [20-tro-ly-ai.webp](../anh-man-hinh/20-tro-ly-ai.webp) | Trợ lý AI (Hỏi Nouri) | `/assistant` | 1440px |
| [21-bao-cao.webp](../anh-man-hinh/21-bao-cao.webp) | Báo cáo (lãng phí, dinh dưỡng tuần) | `/reports` | 1440px |
| [22-ho-so.webp](../anh-man-hinh/22-ho-so.webp) | Hồ sơ dinh dưỡng | `/profile` | 1440px |
| [23-trang-chu-da-dang-nhap.webp](../anh-man-hinh/23-trang-chu-da-dang-nhap.webp) | Trang chủ khi đã đăng nhập (Xin chào, Đăng xuất) | `/` | 1440px |
| [30-dien-thoai-trang-chu-1.webp](../anh-man-hinh/30-dien-thoai-trang-chu-1.webp), [30-dien-thoai-trang-chu-2.webp](../anh-man-hinh/30-dien-thoai-trang-chu-2.webp) | Điện thoại: Trang chủ (khách) | `/` | 390px |
| [31-dien-thoai-tong-quan.webp](../anh-man-hinh/31-dien-thoai-tong-quan.webp) | Điện thoại: Tổng quan | `/dashboard` | 390px |
| [32-dien-thoai-kho.webp](../anh-man-hinh/32-dien-thoai-kho.webp) | Điện thoại: Kho | `/pantry` | 390px |
| [33-dien-thoai-thuc-don.webp](../anh-man-hinh/33-dien-thoai-thuc-don.webp) | Điện thoại: Thực đơn | `/meal-plans` | 390px |
| [34-dien-thoai-cong-thuc.webp](../anh-man-hinh/34-dien-thoai-cong-thuc.webp) | Điện thoại: Công thức | `/recipes` | 390px |
| [40-admin-tong-quan.webp](../anh-man-hinh/40-admin-tong-quan.webp) | Admin: Tổng quan (thống kê) | `/admin` | 1440px |
| [41-admin-cong-thuc.webp](../anh-man-hinh/41-admin-cong-thuc.webp) | Admin: Công thức | `/admin/recipes` | 1440px |
| [42-admin-sua-mon.webp](../anh-man-hinh/42-admin-sua-mon.webp) | Admin: Sửa công thức | `/admin/recipes/cmvtmoiab001umx4nrr0uzl9n/edit` | 1440px |
| [43-admin-nguoi-dung.webp](../anh-man-hinh/43-admin-nguoi-dung.webp) | Admin: Người dùng | `/admin/users` | 1440px |
| [44-admin-kiem-duyet.webp](../anh-man-hinh/44-admin-kiem-duyet.webp) | Admin: Kiểm duyệt cộng đồng | `/admin/moderation` | 1440px |
| [45-admin-nhat-ky.webp](../anh-man-hinh/45-admin-nhat-ky.webp) | Admin: Nhật ký thao tác | `/admin/audit-logs` | 1440px |
| [50-ho-so-di-ung.webp](../anh-man-hinh/50-ho-so-di-ung.webp) | Hồ sơ: ô Dị ứng đã thêm "trứng gà" (thành thẻ Trứng), đang gõ "trứng" → gợi ý theo nhóm (danh sách gợi ý che dòng "Sẽ tránh", xem 50b; chưa lưu) | `/profile` | 1440px |
| [50b-ho-so-se-tranh.webp](../anh-man-hinh/50b-ho-so-se-tranh.webp) | Hồ sơ: ô Dị ứng đã thêm "trứng gà" và "tôm" (chưa lưu), dòng "Sẽ tránh: Trứng (…), Giáp xác (…)" | `/profile` | 1440px |
| [52-the-mon-chua-di-ung.webp](../anh-man-hinh/52-the-mon-chua-di-ung.webp) | Công thức: Hiện tất cả, thẻ món mang nhãn "Chứa: …" (hồ sơ tạm dị ứng Đậu nành) | `/recipes` | 1440px |
| [53-duyet-hoa-don.webp](../anh-man-hinh/53-duyet-hoa-don.webp) | Quét hóa đơn: màn duyệt trước khi lưu (chế độ dự phòng, hóa đơn dựng) | `/pantry?scan=1` | 1440px |
| [54-admin-danh-muc.webp](../anh-man-hinh/54-admin-danh-muc.webp) | Admin: Danh mục dữ liệu (tab Nhóm dị ứng) | `/admin/catalog` | 1440px |

Quan sát từ ảnh, dùng được cho Chương 5:

- **Ảnh 53**: chế độ dự phòng (Tesseract) đọc được 3/3 dòng hàng của hóa đơn dựng, nhưng dòng 1 "Ca rot 1kg" bị đọc thành "Ca. ot 1KG corse
  mms", nên tên thành "Ca. ot corse mms", nhóm "Khác"; màn duyệt gắn nhãn "Tên chưa khớp thực phẩm quen thuộc" và "Chữ mờ, kiểm tra lại".
  Dòng 2 "Trung ga 10 qua" được chuẩn hóa thành "Trứng", nhóm "Trứng & sữa", hạn ước tính 24/11/2026. Ảnh minh họa vì sao màn duyệt là bắt
  buộc; đây **không** phải số đo độ chính xác OCR.
- **Ảnh 52**: với dị ứng "Đậu nành", thẻ "Bánh mì đậu hũ sả" ghi "Chứa: Đậu nành (Đậu hũ, Nước tương)", "Bánh mì ốp la" và "Bò xào bông cải"
  ghi "Chứa: Đậu nành (Nước tương)"; dòng trên lưới: "Đang hiện cả 15 món có thành phần bạn dị ứng hoặc không hợp chế độ ăn của bạn".
- **Ảnh 50, 50b**: gõ "trứng" gợi ý Trứng, Trứng gà, Trứng vịt, Trứng cút, Trứng gà ta, Sốt trứng (nhóm Trứng) và Mì trứng (nhóm Gluten);
  "trứng gà" thành thẻ "Trứng", "tôm" thành thẻ "Giáp xác"; dòng "Sẽ tránh: Trứng (trứng, lòng đỏ, lòng trắng…), Giáp xác (tôm, tôm sú, tôm
  thẻ…)".
- Nhiều thẻ món còn ô chữ thay cho ảnh (vd. "Bánh mì đậu hũ sả", "Bò xào bông cải", "Bún bò Nam Bộ" ở ảnh 52): ảnh món thật chưa được thay
  (`upload:recipe-photos`), nên cần chụp lại bộ ảnh sau khi thay ảnh món (`danh-sach-anh.md`). Ảnh 51 (hộp xem trước "Đã ăn") chưa chụp.

## 6. Route của frontend

Nguồn: `frontend/src/App.tsx`. "Đăng nhập" = có access token (`ProtectedRoute`; chưa đăng nhập thì chuyển `/login`). "Admin" = thêm
`AdminRoute` (không phải Admin thì chuyển `/dashboard`). Kiểm quyền thật nằm ở backend (`requireAuth`, `requireAdmin`); route chỉ điều hướng
giao diện.

| Đường dẫn | Trang (component) | Vai trò cần có |
|---|---|---|
| `/` | Trang chủ (`LandingPage`) | Không |
| `/login` (cả `?mode=register`) | Đăng nhập / Đăng ký (`LoginPage`) | Không |
| `/forgot-password` | Quên mật khẩu (`ForgotPasswordPage`) | Không |
| `/reset-password` | Đặt lại mật khẩu (`ResetPasswordPage`) | Không (cần token trong liên kết email) |
| `/tat-nhac-han` | Tắt nhắc hạn một chạm (`UnsubscribeExpiryPage`) | Không (token trong liên kết email) |
| `/privacy` | Quyền riêng tư (`PrivacyPage`) | Không |
| `/terms` | Điều khoản (`TermsPage`) | Không |
| `/dashboard` | Tổng quan (`DashboardPage`) | Đăng nhập |
| `/pantry` (cả `?scan=1`, `?item=`) | Kho thực phẩm, quét hóa đơn (`PantryPage`) | Đăng nhập |
| `/meal-plans` | Thực đơn (`MealPlansPage`) | Đăng nhập |
| `/meal-plans/:id` | Thực đơn theo mã (`MealPlansPage`) | Đăng nhập |
| `/recipes` | Công thức (`RecipesPage`) | Đăng nhập |
| `/recipes/favorites` | Món yêu thích (`FavoriteRecipesPage`) | Đăng nhập |
| `/recipes/:id` | Chi tiết công thức (`RecipeDetailPage`) | Đăng nhập |
| `/community` | Cộng đồng (`CommunityPage`) | Đăng nhập |
| `/assistant` | Trợ lý AI "Hỏi Nouri" (`AiAssistantPage`) | Đăng nhập |
| `/profile` | Hồ sơ dinh dưỡng (`ProfilePage`) | Đăng nhập |
| `/reports` | Báo cáo (`ReportsPage`) | Đăng nhập |
| `/admin` | Admin: Tổng quan, thống kê (`AdminStatsPage`) | Admin |
| `/admin/recipes` | Admin: Công thức (`AdminRecipesPage`) | Admin |
| `/admin/recipes/new` | Admin: Thêm công thức (`AdminRecipeEditorPage`) | Admin |
| `/admin/recipes/:id/edit` | Admin: Sửa công thức (`AdminRecipeEditorPage`) | Admin |
| `/admin/users` | Admin: Người dùng (`AdminUsersPage`) | Admin |
| `/admin/moderation` | Admin: Kiểm duyệt cộng đồng (`AdminModerationPage`) | Admin |
| `/admin/catalog` | Admin: Danh mục dữ liệu (`AdminCatalogPage`) | Admin |
| `/admin/audit-logs` | Admin: Nhật ký thao tác (`AdminAuditLogsPage`) | Admin |
| `/dev/ui` | Trang thử thành phần giao diện (`DevUiPage`) | Chỉ có ở bản dev (`import.meta.env.DEV`), không có trong bản build |
| `*` (đường dẫn khác) | Chuyển về `/` | Không |

Tổng: 26 đường dẫn có trang (không tính `/dev/ui` và `*`): 7 công khai, 11 cần đăng nhập, 8 khu Admin. Trang chủ và Đăng nhập tải ngay, các
trang khác tải khi mở (`React.lazy`).

## 7. Số dòng mã (không tính test)

Đếm tệp `.ts`, `.tsx`, `.css` do git theo dõi; bỏ `*.test.ts(x)`, `*.perf.test.ts` và thư mục `test/` (100 tệp test bị loại).

| Thư mục | Số tệp | Số dòng | Dòng không trống |
|---|---|---|---|
| `backend/src/modules` | 104 | 7.290 | 6.547 |
| `backend/src/services` | 30 | 2.443 | 2.180 |
| `frontend/src` | 249 | 20.669 | 19.014 |

- `frontend/src` theo loại tệp: `.tsx` 11.053 dòng, `.ts` 5.566, `.css` 4.050.
- `backend/src/modules` theo module (số tệp không phải test): admin 15, recommendation 13, meal-plans 13, ai 9, notifications 8, auth 7,
  community 7, pantry 6, recipes 6, receipt-scan 5, dashboard 4, profile 4, reports 3, catalog 2, suggestions 2.

## 8. Lỗi và sự cố gặp phải

1. **Script chụp ảnh dừng ở bước đăng nhập (lần 1).** `.env` không có `DEMO_EMAIL`/`DEMO_PASSWORD` (chỉ kiểm tên biến), script thoát mã 1 sau
   4 ảnh trang khách. Thông báo lỗi có in ra, nhưng bộ lọc chữ "password" dùng để không lộ mật khẩu đã ẩn mất dòng đó. Xử lý: truyền tài
   khoản demo công khai (ghi trong README) qua biến môi trường cho lần chạy, không sửa `.env`.
2. **Script chụp ảnh dừng ở ảnh 16 (lần 2).** `locator.fill: Timeout 30000ms exceeded` khi chờ `getByRole('searchbox')`: ô tìm ở `/recipes` đã
   đổi sang combobox dùng chung (commit `337932c`, 13/11) nhưng `e2e/acceptance/screenshots.cjs` chưa đổi. **Chưa sửa** (lượt này không sửa
   mã); bộ ảnh được chụp bằng một bản tạm ngoài repo, chỉ đổi bộ chọn này và thêm các ảnh 50–54. Cần sửa script trong repo ở lượt sau.
3. **Ảnh 50:** danh sách gợi ý che dòng "Sẽ tránh", nên chụp thêm ảnh 50b.
4. **Cảnh báo khi khởi động backend** (không phải lỗi): Prisma báo thuộc tính `package.json#prisma` sẽ bị bỏ ở Prisma 7.
5. Cột thời gian của `eval:mealplan` khác lần đo 15/11 (mục 3): dao động theo máy, đã giữ bản mới theo quy tắc của nhiệm vụ.
