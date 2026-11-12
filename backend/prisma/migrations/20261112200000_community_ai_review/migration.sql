-- Kiểm duyệt bài cộng đồng bằng AI: bài chờ duyệt, lý do AI; nhật ký Admin "Duyệt bài".
ALTER TABLE "CommunityPost" ADD COLUMN "pendingReviewAt" TIMESTAMP(3),
ADD COLUMN "aiReviewReason" TEXT;

ALTER TYPE "AdminAuditAction" ADD VALUE 'POST_APPROVE';
