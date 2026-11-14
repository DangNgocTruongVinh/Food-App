# Câu SQL mẫu để demo cơ sở dữ liệu

Các câu dưới đây đọc thẳng database PostgreSQL của Nouri: danh mục nghiệp vụ (dị ứng, nhóm thực phẩm) và dữ liệu người dùng
(kho, lịch sử kho, thực đơn). Tất cả chỉ đọc (`SELECT`), chạy được nhiều lần, không thay đổi dữ liệu.

**Mở psql** (Docker đang chạy, ở thư mục gốc dự án; cổng 5432 chỉ mở cho máy này):

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

`$POSTGRES_USER`, `$POSTGRES_DB` là biến môi trường bên trong container postgres (lấy từ `.env`), nên gõ nguyên văn như trên.
Tên bảng và tên cột có chữ hoa (Prisma đặt theo tên model), nên phải để trong ngoặc kép: `"AllergenGroup"`, `"hiddenAt"`.
Trong psql, gõ `\x auto` để dòng dài tự xuống hàng; `\q` để thoát.

## 1. Danh mục nhóm dị ứng và tên gọi khác

Nhóm con hiện tên nhóm cha (Hải sản → Cá, Giáp xác, Nhuyễn thể); mục đã ẩn (`hiddenAt` khác null) không được bộ lọc dùng.

```sql
SELECT g.code, g.label AS nhom, p.label AS nhom_cha,
       string_agg(a.name, ', ' ORDER BY a."sortOrder") AS ten_goi_khac
FROM "AllergenGroup" g
LEFT JOIN "AllergenGroup" p ON p.id = g."parentId"
LEFT JOIN "AllergenAlias" a ON a."groupId" = g.id AND a."hiddenAt" IS NULL
WHERE g."hiddenAt" IS NULL
GROUP BY g.id, p.label
ORDER BY g."sortOrder";
```

## 2. Nguyên liệu thuộc một nhóm, theo mức "chứa" / "có thể chứa"

`processed = true`: nguyên liệu chế biến/gia vị (nước mắm, dầu hào…) — dị ứng vẫn lọc, "Món không thích" bỏ qua.

```sql
SELECT g.label AS nhom, t.level AS muc, t.name AS nguyen_lieu, t.processed AS che_bien
FROM "AllergenTerm" t
JOIN "AllergenGroup" g ON g.id = t."groupId"
WHERE g.code = 'GLUTEN' AND t."hiddenAt" IS NULL
ORDER BY t.level, t."sortOrder";
```

Ngoại lệ (tên chứa cụm này thì không thuộc nhóm, vd. "sữa đậu nành" không thuộc Sữa):

```sql
SELECT g.label AS nhom, e.phrase AS ngoai_le
FROM "AllergenExclusion" e JOIN "AllergenGroup" g ON g.id = e."groupId"
ORDER BY g."sortOrder", e.phrase;
```

## 3. Món có nguyên liệu thuộc nhóm X (ví dụ Giáp xác)

So nguyên từ bằng biểu thức chính quy `\m…\M` (đầu/cuối từ): "ốc" khớp "Ốc hương", không khớp "Quốc". Đây là bản SQL rút gọn để
minh họa; bộ lọc thật trong backend (`services/allergy-groups.ts`) còn tính ngoại lệ, tên gọi khác và chữ không dấu.

```sql
SELECT DISTINCT r.name AS mon, i.name AS nguyen_lieu, t.name AS khop_voi, t.level AS muc
FROM "Recipe" r
JOIN "RecipeIngredient" i ON i."recipeId" = r.id
JOIN "AllergenTerm" t ON lower(i.name) ~ ('\m' || t.name || '\M') AND t."hiddenAt" IS NULL
JOIN "AllergenGroup" g ON g.id = t."groupId"
WHERE g.code = 'CRUSTACEAN' AND r."deletedAt" IS NULL AND r."hiddenAt" IS NULL
ORDER BY r.name;
```

## 4. Nhóm thực phẩm và hạn dùng ước tính

Hạn mặc định theo nhóm và hạn riêng theo loại (đậu khô, đồ khô, bánh mì…) dùng khi bấm "Đã mua" hoặc quét hóa đơn.

```sql
SELECT c.name AS nhom, c."defaultStorage" AS bao_quan, c."defaultShelfLifeDays" AS han_ngay,
       r.pattern AS loai_rieng, r."matchMode" AS cach_khop, r."shelfLifeDays" AS han_rieng, r.storage AS bao_quan_rieng
FROM "FoodCategory" c
LEFT JOIN "FoodShelfLifeRule" r ON r."categoryId" = c.id
WHERE c."hiddenAt" IS NULL
ORDER BY c."sortOrder", r.priority;
```

## 5. Kho sắp hết hạn (3 ngày tới) của từng người

```sql
SELECT u.email, p.name AS thuc_pham, p.category AS nhom, p.quantity, p.unit,
       p."expiryDate"::date AS het_han, p."expiryDate"::date - CURRENT_DATE AS con_ngay
FROM "PantryItem" p
JOIN "User" u ON u.id = p."userId"
WHERE p.quantity > 0 AND p."expiryDate" IS NOT NULL
  AND p."expiryDate" < CURRENT_DATE + INTERVAL '4 days'
ORDER BY p."expiryDate", u.email;
```

`con_ngay` âm là đã quá hạn.

## 6. Lịch sử kho theo nguồn (30 ngày gần nhất)

Nguồn: `PURCHASE` (Đã mua ở danh sách đi chợ), `RECEIPT_SCAN` (quét hóa đơn), `CONSUMPTION` (trừ kho khi ăn), `MANUAL_*` (tự thêm/sửa/xóa).

```sql
SELECT source AS nguon, count(*) AS so_lan,
       count(*) FILTER (WHERE delta > 0) AS so_lan_nhap, count(*) FILTER (WHERE delta < 0) AS so_lan_xuat
FROM "PantryTransaction"
WHERE "createdAt" >= now() - INTERVAL '30 days' AND "reversalOfId" IS NULL AND "reversedAt" IS NULL
GROUP BY source
ORDER BY so_lan DESC;
```

## 7. Lãng phí theo tuần

"Bỏ đi" = xóa khỏi kho với lý do Bỏ đi (`MANUAL_DELETE` + `DISCARDED`), giống trang Báo cáo; bỏ qua dòng đã hoàn tác. Tuần tính theo
giờ Việt Nam, bắt đầu thứ Hai.

```sql
SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS tuan,
       count(*) AS so_lan_bo_di,
       round(sum(-delta * coalesce("unitPrice", 0))::numeric) AS gia_tri_uoc_tinh_vnd
FROM "PantryTransaction"
WHERE source = 'MANUAL_DELETE' AND "removalReason" = 'DISCARDED' AND "reversalOfId" IS NULL AND "reversedAt" IS NULL
GROUP BY tuan
ORDER BY tuan DESC
LIMIT 8;
```

## 8. Món được nấu nhiều nhất

Món trong thực đơn đã đánh dấu "Đã ăn" (`completed = true`), đếm trên mọi người dùng.

```sql
SELECT r.name AS mon, count(*) AS so_lan_da_an, count(DISTINCT m."userId") AS so_nguoi
FROM "MealPlanItem" i
JOIN "MealPlanDay" d ON d.id = i."dayId"
JOIN "MealPlan" m ON m.id = d."mealPlanId"
JOIN "Recipe" r ON r.id = i."recipeId"
WHERE i.completed
GROUP BY r.id
ORDER BY so_lan_da_an DESC, r.name
LIMIT 10;
```
