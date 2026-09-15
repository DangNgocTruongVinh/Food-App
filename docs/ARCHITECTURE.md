# Kiến trúc hệ thống

## Luồng chính

```text
React SPA -> REST API (Express) -> PostgreSQL
                     |
                     +-> OpenAI Responses API
```

API key AI chỉ tồn tại ở backend. Frontend không gọi trực tiếp OpenAI.

## Miền nghiệp vụ

### Cấu trúc module sau cleanup V1

Các module nằm tại `backend/src/modules/auth`, `backend/src/modules/profile` và
`backend/src/modules/pantry`, `backend/src/modules/recipes`, `backend/src/modules/meal-plans`,
`backend/src/modules/ai`.
Mỗi module gồm `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.schema.ts` và `*.test.ts`.

```text
app.ts -> module.routes -> middleware validate/requireAuth -> controller -> service -> Prisma
                                                                            |
                                                                            +-> nutrition.service (Profile)
                                                                            +-> AI/nutrition services (Meal Plan)
```

Route chỉ khai báo URL, middleware và controller. Schema Zod chứa validation đầu vào;
controller nhận body/userId và trả HTTP response; service xử lý nghiệp vụ và truy cập Prisma.
Auth service ký JWT bằng cấu hình hiện có. `requireAuth`, `validate`, `asyncHandler`,
`HttpError` và `errorHandler` tiếp tục dùng chung, giữ nguyên hành vi V1.
Các module khác vẫn giữ cấu trúc `routes/` và `services/` hiện tại.

Frontend dùng `features/auth` cho API và lưu phiên; `features/profile`,
`features/pantry`, `features/recipes`, `features/meal-plans` và `features/ai` chứa API,
query và logic nghiệp vụ tương ứng.
Cấu hình QueryClient nằm ở `api/query-client.ts`; các query key dùng chung nằm ở
`api/query-keys.ts`. Key, staleTime, retry và invalidation
giữ nguyên. Khi đăng nhập, đổi tài khoản hoặc đăng xuất, Auth session helper xóa toàn bộ
QueryClient để dữ liệu người dùng cũ không còn trong cache.

Xem [báo cáo refactor Auth + Profile](REFACTOR_V1.md) để biết danh sách file,
kiểm thử, hợp đồng API và các vấn đề được giữ lại ngoài phạm vi.
Xem thêm [báo cáo refactor Pantry](PANTRY_REFACTOR.md).

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
