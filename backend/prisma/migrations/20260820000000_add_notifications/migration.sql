CREATE TYPE "NotificationType" AS ENUM (
  'PANTRY_EXPIRING',
  'PANTRY_EXPIRED',
  'PANTRY_LOW_STOCK',
  'MEAL_REMINDER',
  'MEAL_PLAN_CREATED',
  'MEAL_PREP_REMINDER',
  'COMMUNITY_LIKE',
  'COMMUNITY_COMMENT',
  'COMMUNITY_REPLY',
  'COMMUNITY_FOLLOW',
  'AI_RECIPE_SUGGESTION',
  'AI_EXPIRY_SUGGESTION',
  'AI_NUTRITION_SUGGESTION'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "relatedId" TEXT,
  "actionUrl" TEXT,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
