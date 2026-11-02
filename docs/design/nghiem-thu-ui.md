# Nghiệm thu giao diện (đợt UI-1 → UI-12)

Ngày rà soát: 02–03/11/2026, nhánh `ui-moi` trước khi gộp vào `main`. Nguồn quy tắc: `docs/design/DESIGN.md` (mục 3, 9, 11, 12, 15).
Bộ ảnh cuối: `docs/design/screens/UI-12/` — 19 trang × 390/768/1440/1920px × sáng/tối (152 ảnh), tên tệp `<trang>_<rộng>_<sang|toi>.png`.

## 1. Cách kiểm

- **Tự động (Playwright):**
  - Trang khách: Landing, Đăng nhập, Đăng ký, Chính sách bảo mật, Điều khoản sử dụng.
  - Trang người dùng (`demo@nouri.vn`, dữ liệu thật + dữ liệu tạm cho ảnh: 1 thực đơn đang áp dụng, 1 bài viết, 1 câu hỏi trợ lý; đã dọn sau khi chụp): Tổng quan, Kho, Thực đơn, Công thức, Chi tiết công thức, Cộng đồng, Trợ lý AI, Hồ sơ.
  - Trang Admin (tài khoản Admin thật trong `.env`): Thống kê, Công thức, Sửa món, Người dùng, Kiểm duyệt, Nhật ký.
- **Mỗi trang, ở 1440px sáng và tối:**
  - Tương phản: mọi phần tử đang hiện có chữ; ngưỡng 4.5:1, chữ lớn 3:1.
  - Chữ dưới 13px.
  - Chuỗi tiếng Anh: trong chữ hiển thị, `aria-label`, `title`, `placeholder`, `alt`.
  - Dấu "·" (trừ dòng cuối footer, đúng mục 13), "→", emoji.
  - Gradient, `backdrop-filter`, animation đang chạy.
  - Chữ nghiêng ngoài logo, chữ in hoa giãn.
  - Hai nút chính trong cùng một vùng.
  - Phông thực tế: mọi chữ phải vẽ bằng Fraunces hoặc Be Vietnam Pro, không rơi về phông hệ thống.
  - Tab qua toàn trang, mỗi điểm dừng phải thấy focus.
- **Mọi cỡ:** không cuộn ngang ở 320/390/768/1440/1920px.
- **Chữ có dấu chồng:** kiểm phông trên các tiêu đề có "ố, ặ, ữ, ỗ, ẫ, ợ" của từng trang. Các lượt UI-1 → UI-11 đã kiểm từng độ đậm và chữ nghiêng.
- **Quét mã nguồn:** chuỗi hiển thị trong `components/`, `pages/`, `layouts/`, `features/` (không còn từ tiếng Anh, "·", "→"); CSS mới không có cỡ chữ < 13px. Test `design-rules.test.ts` chặn mã màu cứng, gradient, `backdrop-filter`, emoji, "→" trong CSS/thành phần mới.

## 2. Kết quả theo trang

Cột "Checklist 3.1" gồm các mục cấm kiểm được tự động (emoji, gradient, kính mờ, số liệu "·"/"→", chữ < 13px, chữ nghiêng, in hoa giãn, animation, tiếng Anh, 2 nút chính một vùng).

| Trang | Checklist 3.1 | Tương phản (sáng + tối) | Tab | Không cuộn ngang 320–1920 | Phông (dấu chồng) | Lỗi console |
|---|---|---|---|---|---|---|
| Landing | Đạt | Đạt (103 chữ) | 20 điểm, Đạt | Đạt | Đạt | Đạt |
| Đăng nhập | Đạt | Đạt (14 chữ) | 10 điểm, Đạt | Đạt | Đạt | Đạt |
| Đăng ký | Đạt | Đạt (15 chữ) | 10 điểm, Đạt | Đạt | Đạt | Đạt |
| Chính sách bảo mật | Đạt | Đạt (36 chữ) | 4 điểm, Đạt | Đạt | Đạt | Đạt |
| Điều khoản sử dụng | Đạt | Đạt (33 chữ) | 4 điểm, Đạt | Đạt | Đạt | Đạt |
| Tổng quan | Đạt | Đạt (108 chữ) | 29 điểm, Đạt | Đạt | Đạt | Đạt |
| Kho thực phẩm | Đạt | Đạt (118 chữ) | 42 điểm, Đạt | Đạt | Đạt | Đạt |
| Thực đơn | Đạt | Đạt (236 chữ) | 83 điểm, Đạt | Đạt | Đạt | Đạt |
| Công thức | Đạt | Đạt (130 chữ) | 40 điểm, Đạt | Đạt | Đạt | Đạt |
| Chi tiết công thức | Đạt | Đạt (109 chữ) | 14 điểm, Đạt | Đạt | Đạt | Đạt |
| Cộng đồng | Đạt | Đạt (65 chữ) | 21 điểm, Đạt | Đạt | Đạt | Đạt |
| Trợ lý AI | Đạt | Đạt (56 chữ) | 17 điểm, Đạt | Đạt | Đạt | Đạt |
| Hồ sơ | Đạt | Đạt (98 chữ) | 33 điểm, Đạt | Đạt | Đạt | Đạt |
| Admin: Thống kê | Đạt | Đạt (53 chữ) | 16 điểm, Đạt | Đạt | Đạt | Đạt |
| Admin: Công thức | Đạt | Đạt (248 chữ) | 88 điểm, Đạt | Đạt (\*) | Đạt | Đạt |
| Admin: Sửa món | Đạt | Đạt (133 chữ) | 129 điểm, Đạt | Đạt | Đạt | Đạt |
| Admin: Người dùng | Đạt (\*\*) | Đạt (82 chữ) | 21 điểm, Đạt | Đạt | Đạt | Đạt |
| Admin: Kiểm duyệt | Đạt (\*\*) | Đạt (53 chữ) | 19 điểm, Đạt | Đạt | Đạt | Đạt |
| Admin: Nhật ký | Đạt (\*\*) | Đạt (79 chữ) | 20 điểm, Đạt | Đạt | Đạt | Đạt |

(\*) Lần quét đầu: ở 768px bảng Công thức (8 cột) tràn khung 123px. Đã sửa: bảng Admin thành thẻ từ ≤ 1023px (DESIGN.md mục 12, 16); quét lại đạt.
(\*\*) Máy quét báo từ "admin" là phần của địa chỉ email `admin@nouri.vn` (dữ liệu, không phải nhãn). Đã sửa chuỗi duy nhất còn dùng chữ "Admin": "Tài khoản Admin: không khóa được Admin khác." → "Tài khoản quản trị viên: không khóa được quản trị viên khác.".

### Checklist mục 3.2 (xem bằng mắt trên bộ ảnh cuối)

| Trang | Một điểm nhấn | Thứ bậc khối | Lời văn theo dữ liệu thật | Icon một bộ (lucide, có chữ/aria-label) |
|---|---|---|---|---|
| Landing | H1 hero | Việc chính đầu là card lớn; thẻ món đầu (khi có ảnh) gấp đôi | Số món theo nhóm từ API | Đạt |
| Đăng nhập / Đăng ký | H1 form | Form trước, khối giới thiệu phụ | Lỗi nói rõ cách sửa | Đạt |
| Tổng quan | H1 hero + món gợi ý | Hàng dinh dưỡng/thực đơn trước, nước là khối phụ | "Dùng 2 nguyên liệu bạn đang có", "2 thực phẩm đã hết hạn" | Đạt |
| Kho | 4 ô thống kê | Bảng chính, cột phải phụ | "Còn 1 ngày", "Dưới mức tối thiểu 1 kg" | Đạt |
| Thực đơn | Thanh 7 ngày + các bữa | Bữa của ngày trước, dinh dưỡng/đi chợ ở cột phải | Calo đã xếp/đã ăn so với mục tiêu hồ sơ | Đạt |
| Công thức | H1 hero | "Dành cho bạn": 1 thẻ lớn + 2 nhỏ | Có trong kho x/y, % mục tiêu calo | Đạt |
| Chi tiết công thức | Tên món | Nguyên liệu/các bước trái, "Dành cho bạn" phải | Cảnh báo dị ứng theo hồ sơ | Đạt |
| Cộng đồng | Ô đăng bài | Bảng tin chính, hướng dẫn ở cột phải | Thời gian thật, số thích/bình luận thật | Đạt |
| Trợ lý AI | Khung chat | Chat chính, ngữ cảnh ở cột phải | Gợi ý câu hỏi theo món sắp hết hạn, chỉ tiêu | Đạt |
| Hồ sơ | Thẻ chỉ tiêu | Form 4 nhóm, thẻ chỉ tiêu dính bên phải | Chỉ tiêu tính từ hồ sơ đã lưu | Đạt |
| Admin | 4 số tổng / bảng | Tab, bảng, thao tác | "Trong đó N bị khóa", số bữa/bài đã dùng món | Đạt |

Sau UI-12, chữ nghiêng chỉ còn ở logo "nouri." (mục 3.2 mới). Các mục 3.1 không tự động hóa được (số liệu minh họa tự đặt, câu quảng cáo chung chung, đánh số nội dung không phải trình tự) đã rà bằng mắt trên bộ ảnh: không còn. Đánh số chỉ có ở các bước nấu và "Cách hoạt động" của Landing, vì cả hai đều là trình tự thật.

## 3. Luồng chính end-to-end (tài khoản thật)

Tài khoản thử mới đăng ký (`thu-ui12-…@nouri.vn`), Admin thật. Kết quả 18/19 tự động đạt; mục còn lại kiểm tay đạt (script đọc khối "Dành cho bạn" trước khi tải xong).

| Bước | Kết quả |
|---|---|
| Đăng ký từ Landing ("Đăng ký miễn phí") → vào Tổng quan | Đạt |
| Hồ sơ: nữ, 29 tuổi, giảm cân, ăn chay, dị ứng Đậu phộng → lưu, có chỉ tiêu | Đạt |
| Kho: thêm "Đậu hũ" hạn sau 2 ngày qua hộp thoại | Đạt |
| Tạo thực đơn 7 ngày từ hôm nay → áp dụng → đánh dấu đã ăn 1 bữa; mọi món đều chay/thuần chay | Đạt |
| Đi chợ: đánh dấu đã mua 1 nguyên liệu | Đạt |
| Công thức: tìm "đậu hũ" → chi tiết, "Dành cho bạn": 1/9 nguyên liệu có trong kho, nhắc đậu hũ sắp hết hạn | Đạt (kiểm tay) |
| Chia sẻ lên cộng đồng: bài có ảnh (Cloudinary) + công thức đính kèm | Đạt |
| Trợ lý AI: gửi câu hỏi → có trả lời (câu trả lời mẫu, chưa có OpenAI key) | Đạt |
| Admin Thống kê: số người dùng, bài viết khớp API | Đạt |
| Admin tạo món thử → sửa calo trên giao diện → xóa (món chưa dùng) | Đạt |
| Admin khóa tài khoản thử → người đó bị đăng xuất về `/login?locked=1` → mở khóa → đăng nhập lại được | Đạt |
| Admin xóa bài thử ở Kiểm duyệt → ảnh trên Cloudinary bị xóa | Đạt |
| Nhật ký ghi đủ 6 thao tác đúng thứ tự (xóa bài, mở khóa, khóa, xóa món, sửa món, tạo món) | Đạt |
| Không lỗi console trong cả luồng | Đạt |

Dọn sau kiểm thử: xóa tài khoản thử (và dữ liệu đi kèm), món thử, bài thử, ảnh thử; xóa đúng các dòng nhật ký Admin do lượt thử tạo; xóa thực đơn, bài viết, tin nhắn tạm của demo. `demo@nouri.vn` đang mở khóa, trở về trạng thái ban đầu (5 thực phẩm, 0 thực đơn, 0 bài).

## 4. Tốc độ tải so với `main`

Cùng máy, cùng cách phục vụ: container `frontend` (nginx, bản build) cổng 8080, backend Docker.
- **Đo trên `main`:** container build từ `84667d8`, trước đợt UI.
- **Đo trên bản mới:** container build lại từ `ui-moi`.
- **Cách đo:** khách hoặc phiên demo đặt sẵn, bộ nhớ đệm trống, trung vị 3 lần.
- **Điện thoại giả lập:** mạng 1,6 Mb/s, độ trễ 150 ms, CPU chậm 4 lần.
- **Dung lượng:** tổng byte nhận về, gồm JS, CSS, ảnh, phông, API.

| Trang | Thiết bị | `main` FCP / LCP | Mới FCP / LCP | `main` dung lượng | Mới dung lượng |
|---|---|---|---|---|---|
| / | Máy tính | 0,73 / 1,42 s | 0,60 / 0,60 s | 12.542 KB | 1.023 KB |
| / | Điện thoại | 9,06 / 9,42 s | 5,14 / 5,14 s | 1.237 KB | 976 KB |
| /login | Máy tính | 0,48 / 0,77 s | 0,44 / 0,44 s | 3.762 KB | 973 KB |
| /login | Điện thoại | 7,97 / 8,26 s | 4,64 / 4,64 s | 3.786 KB | 893 KB |
| /dashboard | Máy tính | 0,38 / 1,01 s | 0,34 / 0,46 s | 9.429 KB | 1.105 KB |
| /dashboard | Điện thoại | 7,14 / 8,64 s | 4,46 / 5,69 s | 1.240 KB | 1.105 KB |
| /pantry | Máy tính | 0,40 / 0,81 s | 0,43 / 0,54 s | 2.810 KB | 1.060 KB |
| /pantry | Điện thoại | 7,07 / 7,07 s | 4,49 / 5,29 s | 1.389 KB | 1.060 KB |
| /meal-plans | Máy tính | 0,46 / 0,82 s | 0,34 / 0,54 s | 1.809 KB | 1.083 KB |
| /meal-plans | Điện thoại | 7,16 / 9,99 s | 4,65 / 6,74 s | 1.446 KB | 1.082 KB |
| /recipes | Máy tính | 0,33 / 0,78 s | 0,36 / 0,48 s | 1.818 KB | 1.096 KB |
| /recipes | Điện thoại | 7,09 / 9,92 s | 4,54 / 7,18 s | 1.703 KB | 1.096 KB |
| /community | Máy tính | 0,41 / 0,66 s | 0,33 / 0,33 s | 1.342 KB | 1.070 KB |
| /community | Điện thoại | 7,49 / 8,48 s | 4,69 / 5,30 s | 1.342 KB | 1.023 KB |
| /assistant | Máy tính | 0,45 / 0,89 s | 0,34 / 0,42 s | 3.511 KB | 1.062 KB |
| /assistant | Điện thoại | 7,16 / 7,16 s | 4,84 / 5,59 s | 1.197 KB | 1.015 KB |

Gói chính: JS 703 → 550 KB, CSS 438 → 105 KB (chưa nén). Ở bản mới, phần lớn dung lượng còn lại là phông và JS.

**Ghi chú về đo điện thoại:**
- Ảnh trang trí cũ (vài MB) không kịp tải trong thời gian đo nên không tính vào số của `main`; bản mới không có ảnh trang trí.
- Bản mới chưa có ảnh món thật. Khi tải ảnh lên, mỗi thẻ món tải thêm một ảnh ≤ 640px (`f_auto,q_auto`).

**Phát hiện thêm:** nginx của container frontend chưa bật nén gzip/brotli (JS nhận về đúng bằng kích thước tệp). Bật nén sẽ giảm JS còn khoảng 175 KB, CSS khoảng 15 KB (xem đề xuất).

## 5. Việc giao diện còn lại

- **Ảnh món thật cho 33 món** (Admin → ảnh công thức): bắt buộc trước demo. Chưa có ảnh thì mọi nơi hiện ô tên món, hero Tổng quan và Landing chỉ có chữ.
- **Việc chờ chức năng ở giai đoạn sau:**
  - GĐ3b: "Gợi ý món" trên dòng sắp hết hạn ở Kho; nhóm đi chợ theo `category` của backend.
  - GĐ3c: "Quét hóa đơn" ở Tổng quan và Kho.
  - GĐ5: "Thêm vào thực đơn", yêu thích, lưu bài, theo dõi, thành viên nổi bật, lưu lượng nước.
- **Đăng xuất:** còn vài request 401 ở `/login` do cache truy vấn bị xóa khi trang cũ còn hiển thị (ghi từ UI-2); làm cùng GĐ4 khi đổi sang refresh token.
- **5 ảnh `/assets/*.jpg`:** giao diện không còn hiển thị (chỉ ảnh Cloudinary mới hiện), nhưng `seed-data.ts` vẫn ghi đường dẫn này vào `Recipe.imageUrl`. Muốn gỡ thì phải đổi seed (`imageUrl: null`) và dữ liệu đang có.
