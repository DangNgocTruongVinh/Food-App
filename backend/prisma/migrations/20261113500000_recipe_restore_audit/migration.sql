-- Admin khôi phục món đã xóa mềm: thêm loại nhật ký.
ALTER TYPE "AdminAuditAction" ADD VALUE 'RECIPE_RESTORE';
