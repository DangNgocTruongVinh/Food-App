# Danh sách ảnh màn hình cần chụp cho quyển

Lập ngày 15/11/2026. **Chưa chụp.** Chụp sau khi đã thay ảnh món thật (`upload:recipe-photos`) và ngay sau `demo:reset`, để mọi ảnh cùng
một trạng thái dữ liệu mẫu. Số hình theo `00-muc-luc.md` mục C. Thư mục đích: `docs/bao-cao/anh-man-hinh/`.

Vì sao phải chụp lại cả bộ cũ (chụp 12/11/2026): sau ngày đó giao diện và dữ liệu đã đổi ba lần — sửa dị ứng theo nhóm và ô gợi ý ở Hồ sơ
(13/11), thêm trang Admin "Danh mục dữ liệu" vào thanh bên Admin (14–15/11), đổi tham số gợi ý nên thứ tự "Dành cho bạn" khác (15/11) —
và ảnh món sẽ được thay bằng ảnh thật.

Trạng thái demo chung (sau `demo:reset`, theo `docs/bao-cao/so-lieu.md` mục 7): tài khoản `demo@nouri.vn`; kho 8 thực phẩm có hạn tính
từ ngày chạy (Đậu hũ còn 1 ngày, Ức gà 2 ngày, …, Gạo 90 ngày); thực đơn mẫu 6 ngày qua có 12 bữa đã ăn; 8 tuần lịch sử kho mẫu cho Báo
cáo; 8 tài khoản mẫu có bài viết và lượt thích. Mọi ảnh là **dữ liệu mẫu**, chú thích hình phải ghi rõ.

## 1. Ảnh đã có, cần chụp lại (chạy lại `npm run e2e:acceptance -- screenshots docs/bao-cao/anh-man-hinh`)

| Tệp | Trang | Trạng thái demo cần có | Dùng cho | Lý do chụp lại |
|---|---|---|---|---|
| `01-trang-chu.webp` | `/` (khách) | Chưa đăng nhập | Phụ lục H (không bắt buộc) | Ảnh món thật |
| `02-dang-nhap.webp` | `/login` | Chưa đăng nhập | Hình 4.12 (nửa trái) | Ảnh món thật ở cột ảnh |
| `03-dang-ky.webp` | `/login?mode=register` | Chưa đăng nhập | Dự phòng | Ảnh món thật |
| `04-quen-mat-khau.webp` | `/forgot-password` | Chưa đăng nhập | Dự phòng | Đồng bộ bộ ảnh |
| `10-tong-quan.webp` | `/dashboard` | Demo sau `demo:reset`: có "Gợi ý cho bạn" kèm lý do dùng đồ sắp hết hạn (Đậu hũ, Ức gà) | **Hình 4.1** | Ảnh món thật |
| `11-kho.webp` | `/pantry` | Kho 8 thực phẩm, có món sắp hết hạn được đánh dấu | **Hình 4.7** | Đồng bộ bộ ảnh |
| `12-kho-lich-su.webp` | `/pantry` (mở lịch sử thay đổi) | Có dòng lịch sử nhiều nguồn; nên có ít nhất một dòng "Đã ăn" và một dòng hoàn tác (xem mục 2, ảnh 51 chụp trước) | **Hình 4.9** | Cần thấy nút hoàn tác |
| `13-quet-hoa-don.webp` | `/pantry?scan=1` | Hộp quét mở, thấy ba chế độ Tự động / Đọc bằng AI / Chế độ dự phòng và số lượt còn lại | **Hình 4.10** | Đồng bộ bộ ảnh |
| `14-thuc-don.webp` | `/meal-plans` | Thực đơn mẫu có bữa đã ăn | **Hình 4.13** | Ảnh món thật |
| `15-cong-thuc.webp` | `/recipes` | Khối "Dành cho bạn" kèm lý do, bên dưới "Tất cả công thức" | **Hình 4.2** | Tham số gợi ý đổi 15/11 + ảnh món thật |
| `16-tim-kiem.webp` | `/recipes` (gõ "com tron") | Ô tìm có kết quả không dấu | **Hình 4.14** | Ảnh món thật |
| `17-chi-tiet-mon.webp` | `/recipes/:id` | Món có "Món tương tự" và "Người khác cũng nấu" (cần tài khoản mẫu) | **Hình 4.3** | Ảnh món thật |
| `18-mon-yeu-thich.webp` | `/recipes/favorites` | Có ít nhất 2 món yêu thích | Dự phòng (4.6.3) | Ảnh món thật |
| `19-cong-dong.webp` | `/community` | Bài của tài khoản mẫu, có bài gắn món | **Hình 4.17** | Ảnh món thật |
| `20-tro-ly-ai.webp` | `/assistant` | Có một lượt hỏi–đáp (cần `OPENAI_API_KEY`); không có key thì chụp trạng thái "chưa bật" và ghi rõ trong chú thích | **Hình 4.15** | Đồng bộ bộ ảnh |
| `21-bao-cao.webp` | `/reports` | 8 tuần dữ liệu mẫu | **Hình 4.16** (chú thích "dữ liệu mẫu") | Đồng bộ bộ ảnh |
| `22-ho-so.webp` | `/profile` | Hồ sơ demo | Hình 4.12 (nửa phải) | Ô dị ứng đổi 13/11 |
| `23-trang-chu-da-dang-nhap.webp` | `/` (đã đăng nhập) | Demo | Dự phòng | Ảnh món thật |
| `30-dien-thoai-trang-chu-1/2.webp` | `/` ở 390 px | Chưa đăng nhập | Dự phòng | Ảnh món thật |
| `31-dien-thoai-tong-quan.webp` | `/dashboard` ở 390 px | Demo | **Hình 4.19** (ghép 3 ảnh) | Ảnh món thật |
| `32-dien-thoai-kho.webp` | `/pantry` ở 390 px | Demo | **Hình 4.19** | Đồng bộ |
| `33-dien-thoai-thuc-don.webp` | `/meal-plans` ở 390 px | Demo | **Hình 4.19** | Ảnh món thật |
| `34-dien-thoai-cong-thuc.webp` | `/recipes` ở 390 px | Demo | Dự phòng | Ảnh món thật |
| `40-admin-tong-quan.webp` | `/admin` | Admin; thanh bên có mục "Danh mục dữ liệu" | **Hình 4.18** (ghép) | Thanh bên Admin đổi 14/11 |
| `41-admin-cong-thuc.webp` | `/admin/recipes` | Admin | Dự phòng (4.6.7) | Ảnh món thật, thanh bên |
| `42-admin-sua-mon.webp` | `/admin/recipes/:id/edit` | Admin | Dự phòng | Ảnh món thật, thanh bên |
| `43-admin-nguoi-dung.webp` | `/admin/users` | Có nhãn "Tài khoản mẫu" | Dự phòng | Thanh bên |
| `44-admin-kiem-duyet.webp` | `/admin/moderation` | Có bài của tài khoản mẫu | **Hình 4.18** (ghép) | Thanh bên |
| `45-admin-nhat-ky.webp` | `/admin/audit-logs` | Có vài dòng nhật ký (nên có dòng `CATALOG_UPDATE` sau khi chụp ảnh 54) | **Hình 4.18** (ghép) | Thanh bên |

## 2. Năm ảnh còn thiếu (chưa có trong script chụp; cần thêm bước vào `e2e/acceptance/screenshots.cjs` hoặc chụp tay)

| Tệp đề xuất | Trang | Trạng thái demo cần có | Dùng cho |
|---|---|---|---|
| `50-ho-so-di-ung.webp` | `/profile`, cắt vùng "Dị ứng / Món không thích" | Đang gõ "trung ga" trong ô dị ứng để thấy gợi ý nhóm Trứng; đã có sẵn một mục dị ứng (vd. "Hải sản") để dòng "Sẽ tránh: …" hiện đủ. **Không lưu**, hoặc trả hồ sơ demo về như cũ sau khi chụp | **Hình 4.4** |
| `51-xem-truoc-da-an.webp` | `/meal-plans`, hộp xem trước sau khi bấm "Đã ăn" ở một bữa chưa ăn | Bữa có nguyên liệu trùng kho (vd. món dùng Ức gà, Gạo) để thấy dòng "sẽ trừ", dòng "không có trong kho" và lượng trừ; chụp trước khi xác nhận. Nếu xác nhận để có dòng lịch sử cho ảnh 12 thì chạy `demo:reset` lại sau cùng | **Hình 4.8** |
| `52-the-mon-chua-di-ung.webp` | `/recipes`, bấm "Hiện tất cả", cắt 2–3 thẻ món | Hồ sơ demo tạm có dị ứng "Đậu nành" (hoặc "Gluten") để thấy cả nhãn "Chứa: Đậu nành (Nước tương)" và "Có thể chứa: Gluten (Tương đen)"; trả hồ sơ về như cũ sau khi chụp | **Hình 4.5** |
| `53-duyet-hoa-don.webp` | `/pantry?scan=1`, màn duyệt sau khi đọc xong | Dùng ảnh hóa đơn **dựng** (như ảnh trong script `demo-flow`, không dùng hóa đơn thật chưa che); thấy dòng chế độ đọc, các dòng hàng có đích "Cộng vào…/Tạo mới", nhãn "Hạn ước tính", mục "Dòng đã bỏ qua"; chụp trước khi lưu | **Hình 4.11** |
| `54-admin-danh-muc.webp` | `/admin/catalog`, tab "Nhóm dị ứng" (nên chụp thêm tab "Nhóm thực phẩm" làm ảnh phụ `54b`) | Admin; danh mục như seed, mở một nhóm (vd. Đậu nành) thấy tên gọi khác, nguyên liệu "Chứa"/"Có thể chứa" | **Hình 4.6** |

## 3. Việc phải làm trước và sau khi chụp

1. Thay ảnh món thật (`upload:recipe-photos`), rồi `demo:reset`.
2. Chụp theo thứ tự: bộ ở mục 1 (script) → ảnh 50, 52 (đổi tạm hồ sơ, trả lại) → 53 (không lưu) → 51 (chụp trước khi xác nhận) → 54.
3. Sau cùng `demo:reset` lại để tài khoản demo sạch; cập nhật `docs/bao-cao/anh-man-hinh/README.md` (bảng tệp, ngày chụp) và dòng "Ảnh màn
   hình" trong `docs/bao-cao/so-lieu.md` mục 6.
4. [CẦN BỔ SUNG: ảnh 20 (Trợ lý AI) và chế độ "Đọc bằng AI" ở ảnh 13/53 cần `OPENAI_API_KEY` đang hoạt động lúc chụp; nếu không có thì
   chú thích hình ghi rõ đang ở chế độ dự phòng.]
