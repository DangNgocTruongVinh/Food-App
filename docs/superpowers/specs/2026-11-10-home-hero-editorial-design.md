# Hero trang chủ — Premium Food Editorial (phương án A)

Ngày 10/11/2026. Trạng thái: đã duyệt 10/11/2026 kèm 4 điểm chỉnh (đã ghi vào bên dưới).

## Ý định
Hero trang chủ (`/`) trông như trang mở đầu một tạp chí ẩm thực: nền kem, chữ xanh rừng, một ảnh món ăn thật làm điểm nhấn.
Bỏ thẻ món nổi trên ảnh. Footer gọn hơn, bỏ dòng bản quyền đồ án.

## Mục tiêu / không làm / tránh
- Mục tiêu: hero nền Warm Ivory; tiêu đề xanh rừng (giữ nguyên chữ "Biết tủ bếp còn gì, tuần này ăn gì."), giữ đoạn mô tả, nút
  "Đăng ký miễn phí" / "Đăng nhập" (hoặc "Về Tổng quan" khi đã đăng nhập) và dòng ghi chú; ảnh `monaz-hastam` tràn mép phải.
- Không làm: không đổi API, backend, routing, nghiệp vụ, đích của nút; không sửa trang khác; không thêm thẻ/huy hiệu thay thẻ món.
- Tránh: hiệu ứng trang trí, nhãn in hoa, gradient, bóng đổ; ảnh nặng làm chậm màn đầu.

## Các hướng đã cân nhắc
- **A. Nền kem, ảnh tràn mép phải (đã chọn)**: đúng chất tạp chí, thoáng; đánh đổi: hero không còn khối xanh đậm.
- B. Giữ nền xanh rừng, ảnh tràn mép phải: gần bản hiện tại, ít tính tạp chí.

## Thiết kế
- **Bố cục ≥ 1024px**: hai cột 5 : 6. Cột chữ căn trái theo lưới 1240px của trang, canh giữa theo chiều dọc. Cột ảnh tràn tới mép phải
  màn hình (không bo góc phía phải), cao `min(86vh, 780px)`, ảnh `object-fit: cover`.
  ```
  | Biết tủ bếp còn gì,          |▓▓▓▓▓▓ ảnh dọc ▓▓▓▓▓|
  | tuần này ăn gì.  (xanh rừng)  |▓▓  nắng xiên, bàn  ▓|
  | mô tả (2–3 dòng, ≤ 46 ký tự)  |▓▓  ăn sáng từ trên ▓|
  | [Đăng ký miễn phí] Đăng nhập  |▓▓▓▓▓ tràn mép ▓▓▓▓▓|
  | ghi chú nhỏ                   |▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓|
  ```
- **< 1024px**: chữ trên, ảnh dưới tràn hết bề ngang (tỉ lệ 4 : 5 trên tablet, 1 : 1 trên điện thoại); nút xếp chồng toàn bề rộng
  trên điện thoại.
- **Chữ (Be Vietnam Pro)**: tiêu đề 600, `clamp(40px, …, 64px)`, giãn dòng 1.04, khoảng chữ −0.035em, màu `--home-ink`; mô tả 18px,
  `--home-ink-2`; ghi chú 14px.
- **Màu**: nền `--home-bg` (ivory), chữ `--home-ink` (xanh rừng); nút chính nền xanh rừng chữ ivory (11:1), nút phụ viền xanh rừng,
  rê chuột thì nền sage nhạt (`--home-soft`). Không thêm vạch hay hoa văn. Chế độ tối dùng lại token `--home-*` (nền xanh đậm, chữ
  ivory, nút chính vàng như các nút khác của trang).
- **Ảnh**: `monaz-hastam` (Unsplash, 3580×5363) cắt dọc, xuất 2 cỡ WebP ~1200px và ~720px (mỗi cỡ ≤ 250 KB) vào
  `public/assets/home/` (nguồn ảnh: tác giả, liên kết, giấy phép ghi ở `public/assets/home/NGUON.txt`), dùng `<picture>`/`srcset` + `sizes`, `fetchpriority="high"`, có `width`/`height` để không nhảy bố cục; alt mô tả
  đúng nội dung ảnh.
- **Bỏ thẻ món**: xóa `HeroRecipeCard`. Khi không còn món trong hero thì danh sách "Món trong Nouri" không cần loại món đó nữa:
  bỏ `heroPhotoRecipe` (và test của nó), thẻ món lấy 6 món đầu từ `/api/recipes/featured` (giới hạn tải 7 → 6, cùng endpoint).
- **Footer**: bỏ chữ "Đồ án tốt nghiệp"; giữ "© 2026 Nouri" chữ nhỏ, đặt cùng hàng với các nhóm liên kết (không thêm dòng, không
  tăng chiều cao); giảm đệm trên/dưới (64 → 40px), khoảng cách cột, cỡ chữ tiêu đề nhóm; giữ đủ các liên kết và logo.
- **Kỹ thuật**: chỉ sửa `LandingHero.tsx`, `LandingPage.tsx`, `LandingRecipes.tsx`, `LandingFooter.tsx`, `landing.logic.ts`
  (+ test), `landing.css`, thêm ảnh. Áp dụng React Best Practices của Vercel khi sửa (ảnh ưu tiên tải, không tính toán thừa khi render).
- **Kiểm tra**: test + typecheck + build; xem 1440 / 834 / 390px sáng và tối trên Docker 8080; bấm thử các nút; audit bằng Web Design
  Guidelines. (Theo duyệt: chỉ test phần vừa sửa + typecheck + build; người dùng tự xem trên localhost:8080.)
- **DESIGN.md**: ghi rõ trang công khai (trang chủ, đăng nhập, đăng ký) dùng bộ màu xanh rừng/ngà; trang trong ứng dụng dùng bảng
  màu bản 8.

## Để người làm tự quyết
Vị trí cắt ảnh (`object-position`) theo từng cỡ màn; khoảng trắng chi tiết trong cột chữ.
