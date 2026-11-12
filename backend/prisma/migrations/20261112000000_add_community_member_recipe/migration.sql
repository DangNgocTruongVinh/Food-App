-- Cộng đồng: công thức tự viết trong bài, Admin ẩn bài, chuyển công thức tự viết thành món trong thư viện.
ALTER TYPE "AdminAuditAction" ADD VALUE 'POST_HIDE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'POST_SHOW';
ALTER TYPE "AdminAuditAction" ADD VALUE 'POST_PROMOTE';

ALTER TABLE "CommunityPost" ADD COLUMN "memberRecipe" JSONB;
ALTER TABLE "CommunityPost" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "CommunityPost" ADD COLUMN "promotedRecipeId" TEXT;

CREATE INDEX "CommunityPost_promotedRecipeId_idx" ON "CommunityPost"("promotedRecipeId");

ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_promotedRecipeId_fkey"
  FOREIGN KEY ("promotedRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
