-- UC24 Yêu thích công thức, UC25 Lưu bài viết.
CREATE TABLE "FavoriteRecipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FavoriteRecipe_userId_recipeId_key" ON "FavoriteRecipe"("userId", "recipeId");
CREATE INDEX "FavoriteRecipe_userId_createdAt_idx" ON "FavoriteRecipe"("userId", "createdAt");
CREATE INDEX "FavoriteRecipe_recipeId_idx" ON "FavoriteRecipe"("recipeId");
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "SavedPost"("userId", "postId");
CREATE INDEX "SavedPost_userId_createdAt_idx" ON "SavedPost"("userId", "createdAt");
CREATE INDEX "SavedPost_postId_idx" ON "SavedPost"("postId");

ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
