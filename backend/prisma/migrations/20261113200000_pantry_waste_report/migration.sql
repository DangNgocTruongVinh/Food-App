-- Báo cáo lãng phí: lý do xóa thực phẩm, đơn giá (tùy chọn), ảnh chụp nhóm/hạn/đơn giá trong lịch sử kho.
CREATE TYPE "PantryRemovalReason" AS ENUM ('USED_UP', 'DISCARDED', 'MISTAKE');

ALTER TABLE "PantryItem" ADD COLUMN "unitPrice" DOUBLE PRECISION;

ALTER TABLE "PantryTransaction" ADD COLUMN "removalReason" "PantryRemovalReason",
ADD COLUMN "category" TEXT,
ADD COLUMN "expiryDate" TIMESTAMP(3),
ADD COLUMN "unitPrice" DOUBLE PRECISION;
