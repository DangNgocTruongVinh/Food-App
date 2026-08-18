# REST API

Base URL local: `http://localhost:4000/api`

Các API ngoài `/health`, `/auth/register` và `/auth/login` yêu cầu header `Authorization: Bearer <JWT>`.

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/health` | Kiểm tra trạng thái API |
| POST | `/auth/register` | Tạo tài khoản |
| POST | `/auth/login` | Đăng nhập |
| GET, PUT | `/profile` | Xem/cập nhật hồ sơ và mục tiêu dinh dưỡng |
| GET, POST | `/pantry` | Danh sách/thêm thực phẩm |
| PUT, DELETE | `/pantry/:id` | Sửa/xóa thực phẩm |
| GET | `/recipes` | Tìm và lọc công thức |
| GET | `/recipes/:id` | Chi tiết công thức |
| GET | `/meal-plans` | Các thực đơn đã lưu |
| GET | `/meal-plans/:id` | Chi tiết thực đơn |
| POST | `/meal-plans/generate` | Tạo thực đơn 7 ngày bằng AI hoặc thuật toán dự phòng |
| PATCH | `/meal-plans/:id/status` | Đổi trạng thái thực đơn |
| PATCH | `/meal-plans/items/:id` | Đánh dấu bữa ăn hoàn thành |
| PATCH | `/meal-plans/shopping/:id` | Đánh dấu nguyên liệu đã mua |
| DELETE | `/meal-plans/:id` | Xóa thực đơn |
| GET | `/ai/history` | Lịch sử trợ lý |
| POST | `/ai/chat` | Hỏi trợ lý dinh dưỡng |
| GET | `/dashboard` | Dữ liệu tổng quan |

Ví dụ tạo thực đơn:

```json
POST /api/meal-plans/generate
{
  "startDate": "2026-08-19"
}
```
