# Kế hoạch giao diện bản 8 + tách khu Admin (nhánh `giai-doan-ui8`)

Lập 10/11/2026, **chờ duyệt**. Quy tắc: chỉ sửa giao diện (JSX/CSS/component trình bày); giữ nguyên API, `features/*.api.ts`,
`*.queries.ts`, `*.logic.ts`, hook; mọi nút, liên kết, hộp thoại hiện có phải còn đủ. Ngoại lệ có chủ đích: điều hướng Admin (mục 3).

> **Trang Đăng nhập/Đăng ký đã xong theo thiết kế của người dùng (commit `6ee41a9`)**: chỉ Be Vietnam Pro, màu riêng `--login-*`,
> bố cục 60/40. Lượt A (U1) và các lượt sau **không được sửa bố cục trang này** (`LoginPage.tsx`, `AuthForm.tsx`, `auth.css`);
> token mới của bản 8 chỉ áp vào nếu khớp, không đổi giá trị `--login-*`. Test kiểm kê nút (mục 4) cũng phải giữ đủ các nút của trang.

## 1. DESIGN.md bản 3 (lượt U1)

- **Màu**: giữ **tên token cũ**, chỉ đổi giá trị → mọi trang đổi màu ngay mà không sửa CSS từng trang; thêm 2 token mới.

| Token | Sáng (bản 8) | Tối (đề xuất, đo lại ở U1) | Ghi chú |
|---|---|---|---|
| `--bg` | #F4F5F2 | #111513 | |
| `--surface` | #FFFFFF | #191E1B | thẻ |
| `--surface-2` | #ECEEEA | #222824 | khối phụ, hover menu (suy từ nền) |
| `--ink` / `--ink-2` | #18211D | #E9EDEA | `--ink-2` = `--ink` (bản 8 chỉ 2 mức chữ) |
| `--muted` | #5C6862 | #A3AEA8 | chữ phụ |
| `--line` / `--border-input` | #E2E6E1 / #C9CFC9 | #2C332F / #3D4741 | |
| `--action` / `--action-hover` | #15803D / #116A32 | #15803D / #116A32 | chữ trắng 5,0:1 / 6,6:1 |
| `--action-text` | #166534 | #6FCF8E | chữ/viền màu chính |
| `--action-soft` (mới) / `--action-soft-text` (mới) | #E7F4EA / #166534 | #183A25 / #9FE0B3 | nền nhạt mục menu đang chọn, nhãn |
| `--warn` / `--warn-bg` | #C2410C / #FFF1E6 | #FB923C / #3A2417 | |
| `--tag-bg` | = `--action-soft` | = `--action-soft` | |

- **Chữ**: chỉ Be Vietnam Pro (bỏ Fraunces khỏi `index.html` và token). Tiêu đề trang 22px/1.3/600; H2 18px/600; H3 16px/600;
  thân 15–16px; số liệu 28px/600 `tabular-nums`; nhỏ nhất 13px. Bỏ "Hero H1 64–72".
- **Bo góc** 8px (ô nhập, nút, chip) / 12px (thẻ, hộp thoại). Không bóng trên thẻ; bóng chỉ cho lớp nổi (menu, hộp thoại).
- **Layout**: ≥ 1024px menu trái 240px cố định (logo, mục chính, mục phụ, cuối: chế độ tối + tài khoản), nội dung tối đa 1200px,
  lề 24–32px, thanh trên mảnh trong vùng nội dung (tiêu đề trang 22px + hành động chính + chuông). < 1024px: thanh trên (logo, chuông,
  tài khoản) + **thanh dưới 5 mục** (Tổng quan, Kho, Thực đơn, Công thức, "Thêm" mở ngăn kéo: Cộng đồng, Trợ lý AI, Hồ sơ, Đăng xuất).
  Footer chỉ còn ở trang công khai; trong ứng dụng, liên kết Điều khoản/Quyền riêng tư nằm cuối menu trái.
- **Giữ luật "không giống AI"** (mục 3), chỉnh lại: bỏ ghi chú "nền ấm + serif"; điểm nhấn mỗi trang = số liệu thật hoặc ảnh món;
  chữ nghiêng bỏ hẳn (logo "nouri." Be Vietnam Pro 700, chấm màu `--action`) — xem câu hỏi 2.
- Mục 13 (khung), 14 (từng trang), 16 (chỗ lệch) viết lại theo bản 8; `contrast.md` + `contrast.test.ts` đo bộ màu mới.

## 2. Thứ tự và chia lượt (mỗi lượt vừa một phiên)

| Lượt | Nội dung | Phạm vi chính |
|---|---|---|
| U1 | Nền tảng: DESIGN.md bản 3, `tokens.css` (sáng/tối), bỏ Fraunces, cỡ chữ, bo góc, `components.css` (nút, thẻ, chip, ô nhập, bảng, hộp thoại), test kiểm kê nút (mục 4) | Mọi trang đổi màu theo token, chưa đổi bố cục |
| U2 | Khung ứng dụng: `AppSidebar`, `AppTopbar`, `MobileTabBar` + ngăn kéo "Thêm" trong `components/layout/`; `AppLayout` mới; chuông, tài khoản, chế độ tối chuyển chỗ | `shell.css`, `notifications.css` |
| U3 | Tách Admin (mục 3): `AdminLayout` dùng cùng khung với menu Admin, chuyển hướng ADMIN | `layouts/`, `AdminRoute`, `layout.logic.ts` (+ test) |
| U4 | **Tổng quan** theo TongQuan8 (mục 5) | `components/dashboard/`, `dashboard.css` |
| U5 | **Kho + quét hóa đơn**: bảng/thẻ thực phẩm, bộ lọc, hộp thêm/sửa, lịch sử kho, `Receipt*` (tiến trình, màn duyệt, hoàn tác) | `components/pantry/`, `pantry.css` |
| U6 | **Thực đơn**: tuần/ngày, đi chợ, "Đã ăn"/"Đã mua"/"Đổi món"/thêm món, các hộp xem trước | `components/meal-plans/` |
| U7 | **Công thức + Chi tiết** (lưới, lọc, "Dành cho bạn", chi tiết, gợi ý, "Thêm vào thực đơn") | `components/recipes/`, `recommendations.css` |
| U8 | **Admin**: Thống kê, Công thức (bảng + form + ảnh), Người dùng, Kiểm duyệt, Nhật ký | `components/admin/`, `admin.css` |
| U9 | Còn lại: Cộng đồng, Trợ lý AI, Hồ sơ, Thông báo, Đăng nhập, Landing/Điều khoản (chỉ đổi token + chữ); nghiệm thu chung, `nghiem-thu-ui.md`, DESIGN mục 16 | |

Mỗi lượt: tách/sửa component của trang trước, xong chạy test + typecheck + build, commit riêng, báo người dùng kiểm tra tay. Không làm
quá 300 dòng/component (quy tắc tổ chức code); CSS mới chỉ token, gỡ CSS cũ của phần đã thay.

## 3. Tách khu Admin (U3)

- Đăng nhập/đăng ký xong: ADMIN → `/admin` (bỏ qua `next`, trừ `next=/recipes/:id`), USER như cũ.
- `AppLayout` (khu người dùng): ADMIN mở bất kỳ trang nào → `<Navigate to="/admin" replace>`, **trừ** `/recipes/:id` (xem trước món).
  Hàm thuần `adminHomeRedirect(pathname)` trong `features/layout/layout.logic.ts` + test.
- `/admin` có khung riêng: menu trái cùng phong cách (Tổng quan, Công thức, Người dùng, Kiểm duyệt, Nhật ký), cuối menu: chế độ tối,
  tài khoản (Đăng xuất). Không có chuông, Kho, Thực đơn... Trang xem trước `/recipes/:id` khi là ADMIN: có nút "Về trang quản trị".
- `AdminRoute`: USER vào `/admin` → `/dashboard` (giữ). Backend không đổi (vẫn `requireAdmin`).

## 4. Cách kiểm không làm mất chức năng (không Playwright từng lượt)

1. **Test kiểm kê** `frontend/src/features/ui/ui8-controls.test.ts` (viết ở U1, trước khi đổi trang): với mỗi trang, danh sách chữ của
   mọi nút/liên kết/hộp thoại hiện có (vd. Tổng quan: "Đánh dấu", "Xem cả tuần", "Thêm thực phẩm", "Quét hóa đơn", "Đổi món khác",
   "Thêm 1 ly nước", "Tìm"; Kho: "Quét hóa đơn", "Hoàn tác hóa đơn", "Đã dùng hết"...) đọc từ mã nguồn thư mục của trang; lượt nào làm
   mất một mục → test đỏ. Bỏ một mục chỉ khi người dùng duyệt (ghi lý do trong test).
2. `git diff main --stat -- frontend/src/features frontend/src/api backend` mỗi lượt: chỉ được có `layout.logic*` và test giao diện.
3. Test sẵn có (`design-rules.test.ts`: không mã màu cứng, gradient, emoji, "→"; `contrast.test.ts`; 432 test frontend) + typecheck + build.
4. Cuối mỗi lượt: danh sách luồng để người dùng bấm thử (390px và 1440px, sáng/tối).
5. Lượt U9: một lần chụp Playwright toàn bộ trang (nếu được cho phép) để lưu bằng chứng `docs/design/screens/UI8/`.

## 5. Tổng quan theo TongQuan8 (U4) — dữ liệu giữ nguyên `GET /api/dashboard` + thực đơn đang áp dụng

- Đầu trang: lời chào theo giờ + tên (22px), ngày hôm nay.
- 4 thẻ số liệu (đề xuất, chờ mockup): Calo hôm nay (đã ăn / mục tiêu, thanh tiến độ), Bữa đã ăn (n/m), Sắp hết hạn (số thực phẩm
  ≤ 3 ngày, màu cảnh báo khi > 0), Thực phẩm trong kho.
- "Thực đơn hôm nay": các bữa, nút "Đánh dấu đã ăn" (giữ hộp xem trước trừ kho và dải Hoàn tác), "Xem cả tuần".
- "Cần dùng sớm": danh sách thực phẩm sắp hết hạn (bấm mở `/pantry?item=`), "Thêm thực phẩm", "Quét hóa đơn".
- "Gợi ý cho bạn": 4 thẻ từ bộ gợi ý (ngữ cảnh today, kèm lý do), "Xem tất cả công thức", ô tìm công thức.
- Chuyển chỗ, không bỏ: đạm/tinh bột/béo (vào thẻ Calo hoặc dòng dưới), "Thêm 1 ly nước" (khối nhỏ), "Đổi món khác" (trên khối gợi ý).
