-- Audit H1: danh sách từ nhận biết thịt/cá (nhãn Ăn chay) và sản phẩm động vật (nhãn Thuần chay) chuyển vào danh mục trong database,
-- dùng lại bảng nhóm dị ứng với cột purpose. Hai nhóm DIET_* do backend tạo khi khởi động nếu chưa có (services/catalog/catalog.service.ts),
-- không dùng cho hồ sơ dị ứng.

-- CreateEnum
CREATE TYPE "AllergenGroupPurpose" AS ENUM ('ALLERGEN', 'DIET_MEAT', 'DIET_ANIMAL');

-- AlterTable
ALTER TABLE "AllergenGroup" ADD COLUMN     "purpose" "AllergenGroupPurpose" NOT NULL DEFAULT 'ALLERGEN';

-- Audit H2: tên tiếng Anh của hạt cây, để dị ứng gõ "walnut", "almond", "cashew" nhận ra nhóm Hạt cây. Chỉ thêm khi nhóm TREE_NUT đã có
-- và chưa có tên đó (database mới thì dữ liệu ban đầu trong prisma/catalog-data.ts đã gồm các tên này).
INSERT INTO "AllergenAlias" ("id", "groupId", "name", "sortOrder")
SELECT 'alias-' || md5(g."id" || a."name"), g."id", a."name", 100 + a."ord"
FROM "AllergenGroup" g
CROSS JOIN (VALUES ('walnut', 0), ('almond', 1), ('cashew', 2)) AS a("name", "ord")
WHERE g."code" = 'TREE_NUT'
ON CONFLICT ("groupId", "name") DO NOTHING;
