-- Nhật ký thao tác Admin (lượt 7 GĐ3). Không có FK tới đối tượng để nhật ký còn sau khi món/bài/bình luận bị xóa.
-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('RECIPE_CREATE', 'RECIPE_UPDATE', 'RECIPE_HIDE', 'RECIPE_SHOW', 'RECIPE_DELETE', 'RECIPE_IMAGE_REPLACE', 'USER_LOCK', 'USER_UNLOCK', 'POST_DELETE', 'COMMENT_DELETE');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('RECIPE', 'USER', 'COMMUNITY_POST', 'COMMUNITY_COMMENT');

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" "AdminAuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

