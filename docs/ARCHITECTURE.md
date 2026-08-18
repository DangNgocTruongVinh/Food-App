# Kiến trúc hệ thống

## Luồng chính

```text
React SPA -> REST API (Express) -> PostgreSQL
                     |
                     +-> OpenAI Responses API
```

API key AI chỉ tồn tại ở backend. Frontend không gọi trực tiếp OpenAI.

## Miền nghiệp vụ

| Module | Trách nhiệm |
|---|---|
| Auth | Đăng ký, đăng nhập, JWT và phân quyền người dùng |
| Profile | Chỉ số cơ thể, mục tiêu, chế độ ăn, dị ứng và khẩu vị |
| Pantry | Thực phẩm đang có, số lượng và hạn sử dụng |
| Recipe | Công thức, nguyên liệu và giá trị dinh dưỡng |
| Meal plan | Kế hoạch ăn 7 ngày, mục tiêu dinh dưỡng và trạng thái |
| Shopping | Tổng hợp nguyên liệu thiếu từ kế hoạch |
| AI | Sinh thực đơn có cấu trúc và tư vấn theo ngữ cảnh người dùng |
| Dashboard | Các chỉ số tổng hợp và cảnh báo |

## Chiến lược AI

1. Backend tính mục tiêu năng lượng theo BMR/TDEE và mục tiêu cân nặng.
2. Lấy hồ sơ, dị ứng, chế độ ăn, khẩu vị và kho thực phẩm gần hết hạn.
3. Gửi ngữ cảnh tối thiểu tới OpenAI và yêu cầu JSON theo schema cố định.
4. Kiểm tra dữ liệu đầu ra bằng Zod, đối chiếu dị ứng và giới hạn calo.
5. Lưu kết quả đã kiểm tra vào PostgreSQL.
6. Khi AI lỗi hoặc chưa cấu hình key, dùng thuật toán chấm điểm công thức để tạo thực đơn dự phòng.

AI chỉ hỗ trợ thông tin dinh dưỡng phổ thông, không thay thế tư vấn y khoa.
