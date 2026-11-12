-- Xóa mềm công thức đã được tham chiếu (Admin xóa món đã có trong thực đơn / bài viết).
ALTER TABLE "Recipe" ADD COLUMN "deletedAt" TIMESTAMP(3);
