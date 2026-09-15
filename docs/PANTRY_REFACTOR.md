# Bàn giao Pantry V2

Ngày hoàn thành code: 15/09/2026. Migration database đang **PENDING** vì workspace
không có `backend/.env` hoặc biến môi trường `DATABASE_URL` hợp lệ. Không tạo/reset
database, không khởi động Docker và chưa chạy `prisma migrate deploy`.

## Cấu trúc module

```text
backend/src/modules/pantry/
  pantry.routes.ts
  pantry.controller.ts
  pantry.schema.ts
  pantry.service.ts
  pantry.test.ts
  pantry-migration.test.ts

frontend/src/features/pantry/
  pantry.api.ts
  pantry.queries.ts
  pantry.test.ts
```

Backend đi theo route → authentication/validation → controller → service → Prisma.
Frontend đi theo PantryPage → query/mutation → API client.

## Chức năng Pantry V2

- Form dùng chung cho thêm và sửa thực phẩm; PUT giữ ownership bằng `id` + `userId`.
- Form và API xử lý `minimumStock` để phục vụ cảnh báo tồn kho thấp.
- `storageLocation` dùng enum `REFRIGERATOR`, `FREEZER`, `DRY_STORAGE` trong Prisma,
  API và frontend. UI không còn suy ra nơi bảo quản từ tên/danh mục/ghi chú.
- Tên và danh mục được trim, đồng thời gom khoảng trắng liên tiếp trước khi service lưu.
- Create/update hiển thị lỗi trong modal; delete hiển thị lỗi trên trang.
- Nếu notification sync lỗi sau khi create/update đã commit, lỗi được ghi log nhưng
  API vẫn trả kết quả CRUD thành công. Notification cleanup của PUT/DELETE vẫn nằm
  trong transaction và giữ ownership hiện có.
- Query key Pantry và invalidation Pantry/Dashboard tiếp tục quản lý tập trung.

## Migration storageLocation

File: `backend/prisma/migrations/20260913000000_add_pantry_storage_location/migration.sql`.

Migration không drop, truncate hoặc delete dữ liệu. Trình tự:

1. Tạo enum `StorageLocation`.
2. Thêm cột nullable để các hàng cũ vẫn hợp lệ.
3. Backfill dữ liệu cũ bằng đúng quy tắc hiển thị Pantry trước V2: freezer, dry storage,
   còn lại refrigerator.
4. Chỉ sau backfill mới đặt default `REFRIGERATOR` và `NOT NULL`.

Ba test tĩnh xác nhận không có thao tác xóa dữ liệu, thứ tự backfill trước `NOT NULL`,
đủ ba mapping và default. `prisma generate` đã pass nên schema Prisma hợp lệ.
Migration chưa được áp dụng vào database thật.

Khi có `DATABASE_URL` hợp lệ, chạy từ `backend/`:

```text
npx prisma migrate status
npx prisma migrate deploy
```

Không dùng `migrate reset`. Nên sao lưu database trước khi deploy trong môi trường có dữ liệu quan trọng.

## Kiểm thử không cần database

- Backend Pantry: GET/POST/PUT/DELETE, auth, ownership, validation, chuẩn hóa text,
  minimumStock, storageLocation, ngày UTC, notification cleanup và lỗi notification sync.
- Frontend Pantry: payload add/edit, minimumStock, storageLocation, bốn API adapter,
  failure propagation, query cache, mutation và invalidation.
- Prisma được mock trong HTTP tests; migration được kiểm tra tĩnh, không kết nối PostgreSQL.

## Giới hạn còn lại

- Tìm kiếm, lọc, sắp xếp và phân trang vẫn chạy ở client sau khi tải toàn bộ Pantry.
- `minimumStock` là một số dùng chung với đơn vị của item; chưa có quy đổi giữa g/kg hoặc ml/l.
- Notification sync failure được log và không phá response CRUD, nhưng chưa có hàng đợi retry bền vững.
- Không có E2E browser test hoặc database integration test do không có database được cấu hình.
