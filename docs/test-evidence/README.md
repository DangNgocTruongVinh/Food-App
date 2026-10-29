# Bằng chứng kiểm thử: Giai đoạn 2c

Ảnh chụp màn hình kiểm thử thủ công trên trình duyệt (Playwright MCP), dùng cho chương Kiểm thử.

| Thông tin | Giá trị |
|---|---|
| Ngày kiểm thử | 29/10/2026 |
| Nhánh / commit | `giai-doan-2c` tại `832f71b` (bộ 33 món mới + kiểm tra kết quả OpenAI) |
| Môi trường | Docker Compose (frontend `:8080`, backend `:4000`, PostgreSQL 16), database đã reset và seed lại |
| Nhánh tạo thực đơn | Thuật toán dự phòng (fallback); chưa cấu hình `OPENAI_API_KEY` |
| Tài khoản | Tài khoản demo của seed |
| Hồ sơ chung | Nữ, vận động vừa, duy trì vóc dáng, **4 bữa/ngày** (3 bữa chính + 1 bữa phụ), không có món không thích |
| Phạm vi | Ở ca 2–4 chỉ kiểm tra ngày hiển thị trong ảnh (Th 6, 30/10/2026) |

## Kết quả

| # | Ảnh | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| 1a | `2026-10-29_01a_cong-thuc_tat-ca-33-mon.png` | Trang Công thức, bộ lọc "Tất cả" | Hiện đủ 33 món của bộ seed mới | **ĐẠT**: "33 công thức phù hợp" |
| 1b | `2026-10-29_01b_cong-thuc_loc-quoc-te.png` | Bộ lọc "Quốc tế" | Chỉ hiện món có `cuisine` khác "Việt Nam" | **ĐẠT**: 6 món (Hàn Quốc, Nhật Bản, Ý, Thái Lan, Hy Lạp, Mỹ) |
| 2 | `2026-10-29_02_thuc-don_an-chay_4-bua.png` | Kiểu ăn: Ăn chay → tạo thực đơn | Mọi món chay; đúng bữa; không lặp món trong ngày | **ĐẠT**: Trứng chiên rau củ / Cơm trộn Hàn Quốc / Nấm kho tiêu / Khoai lang luộc; món thay thế đều chay |
| 3 | `2026-10-29_03_thuc-don_thuan-chay_4-bua.png` | Kiểu ăn: Thuần chay → tạo thực đơn | Không có thịt, cá, trứng, sữa; đúng bữa | **ĐẠT**: Sữa đậu nành / Nấm kho tiêu / Canh chua chay / Khoai lang luộc; món thay thế đều thuần chay |
| 4 | `2026-10-29_04_thuc-don_di-ung-hai-san_4-bua.png` | Kiểu ăn: Cân bằng, dị ứng: Hải sản* → tạo thực đơn | Không có cá, tôm, nước mắm; đúng bữa | **ĐẠT**: Trứng chiên rau củ / Cơm trộn Hàn Quốc / Gà teriyaki / Khoai lang luộc; không có món hải sản |
| 2–4 | (cả ba ảnh) | Khối "Gợi ý cho bạn" | Gợi ý không mâu thuẫn với hồ sơ | **KHÔNG ĐẠT**: luôn gợi ý "Bổ sung cá béo… Omega-3" cho người ăn chay, thuần chay và dị ứng hải sản. Đã sửa sau lần thử này (`mealPlanSuggestions`), cần chụp lại. |

\* Giá trị ô "Dị ứng thực phẩm" không được lưu trong snapshot của Playwright; dị ứng "Hải sản" ghi theo kịch bản kiểm thử.

## Phát hiện khác

- **Ảnh minh họa không theo món:** ảnh lớn của bữa tối trong ca 2–4 là ảnh cá hồi dù món là "Nấm kho tiêu", "Canh chua chay" hoặc "Gà teriyaki". Trang Thực đơn chọn ảnh theo bữa (`mealImage`) chứ chưa dùng `imageUrl` của công thức. **Đã sửa** (`mealItemImage` dùng ảnh của chính công thức), cần chụp lại.
- **Lỗi console:** `TypeError: K is not a function` khi chuyển từ trang Công thức sang Hồ sơ. Image frontend trong Docker dùng React 19.3.0, còn bản local dùng 19.2.8, vì Dockerfile chạy `npm install` mà không có lockfile. **Đã sửa cấu hình build** (`npm ci` với lockfile ở thư mục gốc; image mới dùng React 19.2.8). Còn chờ kiểm tra lại trên trình duyệt.
