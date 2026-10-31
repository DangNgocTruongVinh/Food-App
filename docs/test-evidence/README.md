# Bằng chứng kiểm thử

Ảnh chụp màn hình và file kiểm thử thủ công trên trình duyệt, dùng cho chương Kiểm thử.

- [Giai đoạn 2c](#giai-đoạn-2c): bộ món mới và lọc thực đơn (29/10/2026).
- [Giai đoạn 3](#giai-đoạn-3): ảnh trong bài viết, xóa EXIF/GPS, hàng nút ô đăng bài (31/10/2026).
- [Hạn chế](#hạn-chế)

## Giai đoạn 2c

Kiểm thử bằng Playwright MCP. Thông tin chung của cả hai lượt:

| Thông tin | Giá trị |
|---|---|
| Ngày kiểm thử | 29/10/2026 |
| Môi trường | Docker Compose (frontend `:8080`, backend `:4000`, PostgreSQL 16) |
| Nhánh tạo thực đơn | Thuật toán dự phòng (fallback); chưa cấu hình `OPENAI_API_KEY` |
| Tài khoản | Tài khoản demo của seed |
| Hồ sơ gốc của tài khoản demo | Nữ, 24 tuổi, 162 cm, 55 kg, vận động vừa, duy trì vóc dáng, Cân bằng, 3 bữa/ngày, không dị ứng, không thích "Cần tây"; chỉ tiêu 1986 kcal / 124 g đạm / 233 g tinh bột / 62 g béo (tính bằng `calculateNutritionTargets`) |

### Lượt 1: bộ món mới và lọc thực đơn

Nhánh `giai-doan-2c` tại `832f71b`; database đã reset và seed lại. Hồ sơ: hồ sơ gốc đổi sang **4 bữa/ngày**, đổi kiểu ăn hoặc dị ứng theo từng ca. Ở ca 2–4 chỉ kiểm tra ngày hiển thị trong ảnh (Th 6, 30/10/2026).

| # | Ảnh | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| 1a | `2026-10-29_01a_cong-thuc_tat-ca-33-mon.png` | Trang Công thức, bộ lọc "Tất cả" | Hiện đủ 33 món của bộ seed mới | **ĐẠT**: "33 công thức phù hợp" |
| 1b | `2026-10-29_01b_cong-thuc_loc-quoc-te.png` | Bộ lọc "Quốc tế" | Chỉ hiện món có `cuisine` khác "Việt Nam" | **ĐẠT**: 6 món (Hàn Quốc, Nhật Bản, Ý, Thái Lan, Hy Lạp, Mỹ) |
| 2 | `2026-10-29_02_thuc-don_an-chay_4-bua.png` | Kiểu ăn: Ăn chay → tạo thực đơn | Mọi món chay; đúng bữa; không lặp món trong ngày | **ĐẠT**: Trứng chiên rau củ / Cơm trộn Hàn Quốc / Nấm kho tiêu / Khoai lang luộc; món thay thế đều chay |
| 3 | `2026-10-29_03_thuc-don_thuan-chay_4-bua.png` | Kiểu ăn: Thuần chay → tạo thực đơn | Không có thịt, cá, trứng, sữa; đúng bữa | **ĐẠT**: Sữa đậu nành / Nấm kho tiêu / Canh chua chay / Khoai lang luộc; món thay thế đều thuần chay |
| 4 | `2026-10-29_04_thuc-don_di-ung-hai-san_4-bua.png` | Kiểu ăn: Cân bằng, dị ứng: Hải sản* → tạo thực đơn | Không có cá, tôm, nước mắm; đúng bữa | **ĐẠT**: Trứng chiên rau củ / Cơm trộn Hàn Quốc / Gà teriyaki / Khoai lang luộc; không có món hải sản |
| 2–4 | (cả ba ảnh) | Khối "Gợi ý cho bạn" | Gợi ý không mâu thuẫn với hồ sơ | **KHÔNG ĐẠT**: luôn gợi ý "Bổ sung cá béo… Omega-3" cho người ăn chay, thuần chay và dị ứng hải sản. Đã sửa và kiểm lại ở ca 6. |
| 2–4 | (cả ba ảnh) | Ảnh lớn của món | Ảnh đúng với món | **KHÔNG ĐẠT**: ảnh bữa tối luôn là cá hồi (chọn theo bữa, không theo món). Đã sửa và kiểm lại ở ca 5–6. |

\* Giá trị ô "Dị ứng thực phẩm" không được lưu trong snapshot của Playwright; dị ứng "Hải sản" ghi theo kịch bản kiểm thử.

### Lượt 2: kiểm tra lại sau khi sửa

Nhánh `giai-doan-2c` tại `1289998` cùng bản sửa luồng xóa thực đơn (chưa commit). Image Docker được build lại bằng `npm ci` với lockfile; seed chạy lại (33/33 món, không trùng slug). Ở ca 5 kiểm tra **cả 7 ngày** qua `GET /api/meal-plans/:id`, không chỉ ngày trong ảnh.

| # | Ảnh | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| 0 | (không có ảnh) | Bundle frontend đang phục vụ | Cùng phiên bản thư viện với lockfile | **ĐẠT**: React 19.2.8 (trước khi sửa: 19.3.0) |
| 0 | (không có ảnh) | Chuyển Công thức → Hồ sơ 4 lần bằng menu chính | Không còn lỗi `TypeError: K is not a function` | **ĐẠT**: 0 lỗi, 0 cảnh báo trong console |
| 5a | `2026-10-29_05a_thuc-don_can-bang_4-bua_ngay-1.png` | Hồ sơ Cân bằng, không dị ứng, 4 bữa/ngày → tạo thực đơn (ngày 30/10) | Đủ 4 bữa; ảnh theo món; gợi ý cá phù hợp vì hồ sơ không có hạn chế | **ĐẠT**: Cháo gà hành gừng (sáng) / Cơm trộn Hàn Quốc / Gà teriyaki / Khoai lang luộc (phụ) |
| 5b | `2026-10-29_05b_thuc-don_can-bang_4-bua_ngay-4-che-bua-phu.png` | Cùng thực đơn, ngày 02/11 | Chè ở bữa phụ | **ĐẠT**: Sữa đậu nành / Bò xào bông cải / Canh bí đỏ nấu tôm / **Chè đậu đen (phụ)** |
| 5 | (kiểm qua API) | Cả 7 ngày của thực đơn ca 5 | Mỗi ngày 4 bữa theo thứ tự sáng, trưa, tối, phụ; mọi món đúng `mealTypes`; phở/cháo chỉ ở bữa sáng; chè chỉ ở bữa phụ; không lặp món trong ngày | **ĐẠT**: 28/28 món đúng bữa; "Cháo gà hành gừng" chỉ ở bữa sáng; "Chè đậu đen" chỉ ở bữa phụ; không ngày nào lặp món |
| 6 | `2026-10-29_06_thuc-don_an-chay_4-bua_goi-y-va-anh-da-sua.png` | Hồ sơ Ăn chay, 4 bữa/ngày → tạo thực đơn | Mọi món chay; gợi ý không có cá; ảnh không phải cá | **ĐẠT**: mọi món chay và đúng bữa; gợi ý "Bổ sung Omega-3 từ thực vật như đậu nành, đậu hũ hoặc hạt óc chó"; "Nấm kho tiêu" hiện ảnh món chay |
| 7 | (không có ảnh) | Hai thực đơn trùng ngày bắt đầu 30/10, vào `/meal-plans` không kèm id | Mở thực đơn tạo sau (`createdAt` mới hơn) | **ĐẠT**: chuyển tới thực đơn tạo sau |
| 8 | (không có ảnh) | Xóa thực đơn khi còn thực đơn khác | Chuyển sang thực đơn còn lại | **ĐẠT**: chuyển sang thực đơn còn lại |
| 9 | (không có ảnh) | Xóa thực đơn cuối cùng | Về `/meal-plans`, hiện trạng thái trống, không có request lỗi | **Lần đầu KHÔNG ĐẠT**: trang ở lại thực đơn vừa xóa và hiện nội dung cũ; sau đó còn một request `GET` chi tiết bị 404. **Sau khi sửa: ĐẠT**: về trạng thái trống, mọi request thành công (`DELETE` 204, `GET` 200), console 0 lỗi |

Sau lượt 2: đã xóa hết thực đơn thử và trả hồ sơ demo về đúng hồ sơ gốc ở bảng đầu.

### Phát hiện còn mở

- **Món bữa tối lặp lại ở bữa trưa hôm sau** (ca 5): ví dụ Gà teriyaki ở bữa tối 30/10 rồi bữa trưa 31/10, Thịt kho trứng ở bữa tối 31/10 rồi bữa trưa 01/11. Điều này không vi phạm quy tắc "không lặp trong cùng ngày". Nguyên nhân: bữa trưa và bữa tối chọn xoay vòng trên gần như cùng một danh sách món, chỉ lệch nhau 1 vị trí. "Phở bò" cũng không xuất hiện trong tuần vì có 8 món bữa sáng cho 7 ngày.

## Giai đoạn 3

### Lượt 6: ảnh trong bài viết, xóa EXIF/GPS (31/10/2026)

| Thông tin | Giá trị |
|---|---|
| Môi trường | Docker Compose (frontend `:8080`, backend `:4000`, PostgreSQL 16), image build lại từ nhánh `giai-doan-3` tại `a5beb0e`; Cloudinary thật |
| Công cụ | Script Playwright (`playwright-core` 1.52, Chromium), không qua Playwright MCP; đọc metadata ảnh bằng `sharp` 0.34.5; kiểm tra thư mục trên Cloudinary bằng Admin API (chạy trong container backend) |
| Tài khoản | Tài khoản demo của seed |
| Ảnh thử | (1) JPEG 1200×800 có EXIF: hãng máy "NouriTestCam", GPS 10°46'N 106°41'E (TP.HCM), tag xoay 6 (xoay 90°); (2) PNG 900×900 không có EXIF |

| # | Bằng chứng | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| 1 | `2026-10-31_gd3-l6_01_xem-truoc-anh_1440.png` | Chọn 2 ảnh ở ô đăng bài | Xem trước 2 ảnh, mỗi ảnh có nút bỏ | **ĐẠT** |
| 2 | (kiểm qua API) | Bấm "Đăng bài" | Gửi multipart; bài trả về `images` theo đúng thứ tự | **ĐẠT**: 201, `images` vị trí 0 (jpg), 1 (png); DB có 2 dòng `CommunityPostImage`; Cloudinary `nouri/posts` có đúng 2 ảnh |
| 3 | `2026-10-31_gd3-l6_exif-gps.txt`, `..._anh-dau-vao-co-gps.jpg`, `..._anh-cloudinary-ban-goc.jpg` | Tải **bản gốc** (URL không có tham số biến đổi) từ Cloudinary, đọc metadata | Không còn EXIF, GPS; ảnh vẫn đúng chiều | **ĐẠT**: đầu vào có EXIF 346 byte + khối GPS + chuỗi hãng máy; bản trên Cloudinary không có EXIF, GPS, XMP, chuỗi hãng máy; kích thước 800×1200 (đã xoay theo tag 6) |
| 4 | `2026-10-31_gd3-l6_02_bai-co-anh_1440.png` | Xem bài trên máy tính (1440px) | Hiện 2 ảnh bằng bản Cloudinary tối ưu | **ĐẠT**: `f_auto,q_auto,c_limit,w_640`, ảnh 1 tải về 640×960 (đứng) |
| 5 | `2026-10-31_gd3-l6_03_bai-co-anh_390.png` | Xem bài trên điện thoại (390px) | Hiện 2 ảnh, không cuộn ngang | **ĐẠT**: không cuộn ngang |
| 6 | (kiểm qua API) | "Xóa bài của tôi": `DELETE /api/community/:postId` bằng token demo (giao diện để GĐ5); xóa lần hai | Bài, ảnh trong DB và ảnh trên Cloudinary đều bị xóa | **ĐẠT**: 204, lần hai 404; DB 0 bài, 0 ảnh; Admin API báo `nouri/posts` trống. URL ảnh (gốc và bản `w_640`) còn 200 khoảng 1 phút rồi 404 (xem [Hạn chế](#hạn-chế)) |
| 7 | (không có ảnh) | Dọn dữ liệu thử | Không còn dữ liệu thử | **ĐẠT**: 33 món, 0 bài viết, 0 ảnh bài viết, 0 thông báo cộng đồng |

### Lượt 6: hàng nút ô đăng bài (31/10/2026)

Phát hiện khi kiểm thử lượt 6 và sửa ở commit `c83d837`. So ảnh trên Vite dev server (cùng backend Docker), trạng thái ô đăng bài có chữ, gắn công thức và 2 ảnh.

| # | Ảnh | Kịch bản | Trước khi sửa | Sau khi sửa |
|---|---|---|---|---|
| 1 | `2026-10-31_gd3-l6_o-dang-bai_390_truoc.png` / `..._390_sau.png` | Điện thoại 390px | "Công thức", "Đăng bài" xuống 2 dòng (thêm nút "Ảnh" làm hàng chật); ở 320px trang cuộn ngang 10px | Số ký tự + "Đăng bài" xuống hàng riêng; "Ảnh", "Công thức" giữ chữ một dòng; ba nút cao 44px; 320–480px không cuộn ngang |
| 2 | `2026-10-31_gd3-l6_o-dang-bai_1440_truoc.png` / `..._1440_sau.png` | Máy tính 1440px | Nút "Ảnh" lệch lên 4,5px so với "Công thức" (nhận lề của quy tắc `.community-composer label`) | Hai nút thẳng hàng; ô đăng bài thấp đi 11px; ngoài ra không đổi |

Từ 520px trở lên kích thước các nút không đổi (đo ở 520, 560, 620, 700, 768, 900, 1100, 1440px).

## Hạn chế

- **Ảnh đã xóa vẫn mở được qua CDN trong thời gian ngắn:** sau khi xóa bài (hoặc thay ảnh công thức), ảnh trên Cloudinary bị xóa ngay và backend có yêu cầu xóa bộ nhớ đệm CDN (`invalidate: true`), nhưng link ảnh cũ còn mở được khoảng 1 phút do bộ nhớ đệm CDN. Sau đó link trả 404.
