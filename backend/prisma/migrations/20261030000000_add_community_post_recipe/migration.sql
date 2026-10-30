-- Bài viết cộng đồng gắn (tùy chọn) một công thức có sẵn.
-- ON DELETE RESTRICT: công thức đang được bài viết gắn thì không xóa hẳn được (GĐ3: chỉ ẩn).
ALTER TABLE "CommunityPost" ADD COLUMN "recipeId" TEXT;

CREATE INDEX "CommunityPost_recipeId_idx" ON "CommunityPost"("recipeId");

ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
