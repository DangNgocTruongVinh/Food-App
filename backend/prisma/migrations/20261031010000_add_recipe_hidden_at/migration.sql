-- Món đã ngừng sử dụng: Admin ẩn món đã được dùng (thực đơn/bài viết) thay vì xóa hẳn.
ALTER TABLE "Recipe" ADD COLUMN "hiddenAt" TIMESTAMP(3);

CREATE INDEX "Recipe_hiddenAt_idx" ON "Recipe"("hiddenAt");
