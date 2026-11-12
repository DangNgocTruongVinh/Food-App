-- Nhắc đồ sắp hết hạn qua email: cài đặt trong hồ sơ và nhật ký đã gửi (khóa chống gửi trùng).
ALTER TABLE "NutritionProfile" ADD COLUMN "expiryEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "expiryEmailDays" INTEGER NOT NULL DEFAULT 2;

CREATE TABLE "ExpiryEmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpiryEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpiryEmailLog_userId_dayKey_slot_key" ON "ExpiryEmailLog"("userId", "dayKey", "slot");
CREATE INDEX "ExpiryEmailLog_userId_createdAt_idx" ON "ExpiryEmailLog"("userId", "createdAt");

ALTER TABLE "ExpiryEmailLog" ADD CONSTRAINT "ExpiryEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
