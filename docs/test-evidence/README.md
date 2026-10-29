# Bằng chứng kiểm thử: Giai đoạn 2c

Ảnh chụp màn hình kiểm thử thủ công trên trình duyệt (Playwright MCP), dùng cho chương Kiểm thử.

Thông tin chung của cả hai lượt:

| Thông tin | Giá trị |
|---|---|
| Ngày kiểm thử | 29/10/2026 |
| Môi trường | Docker Compose (frontend `:8080`, backend `:4000`, PostgreSQL 16) |
| Nhánh tạo thực đơn | Thuật toán dự phòng (fallback); chưa cấu hình `OPENAI_API_KEY` |
| Tài khoản | Tài khoản demo của seed |
| Hồ sơ gốc của tài khoản demo | Nữ, 24 tuổi, 162 cm, 55 kg, vận động vừa, duy trì vóc dáng, Cân bằng, 3 bữa/ngày, không dị ứng, không thích "Cần tây"; chỉ tiêu 1986 kcal / 124 g đạm / 233 g tinh bột / 62 g béo (tính bằng `calculateNutritionTargets`) |

## Lượt 1: bộ món mới và lọc thực đơn

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

## Lượt 2: kiểm tra lại sau khi sửa

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

## Phát hiện còn mở

- **Món bữa tối lặp lại ở bữa trưa hôm sau** (ca 5): ví dụ Gà teriyaki ở bữa tối 30/10 rồi bữa trưa 31/10, Thịt kho trứng ở bữa tối 31/10 rồi bữa trưa 01/11. Điều này không vi phạm quy tắc "không lặp trong cùng ngày". Nguyên nhân: bữa trưa và bữa tối chọn xoay vòng trên gần như cùng một danh sách món, chỉ lệch nhau 1 vị trí. "Phở bò" cũng không xuất hiện trong tuần vì có 8 món bữa sáng cho 7 ngày.
