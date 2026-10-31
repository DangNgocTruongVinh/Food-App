-- Ảnh trong bài viết cộng đồng (tối đa 4 ảnh/bài), xóa theo bài.
CREATE TABLE "CommunityPostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityPostImage_postId_position_idx" ON "CommunityPostImage"("postId", "position");

ALTER TABLE "CommunityPostImage" ADD CONSTRAINT "CommunityPostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
