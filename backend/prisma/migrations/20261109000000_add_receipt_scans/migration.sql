-- CreateEnum
CREATE TYPE "ReceiptOcrProvider" AS ENUM ('TESSERACT', 'OPENAI', 'MOCK');

-- CreateEnum
CREATE TYPE "ReceiptScanStatus" AS ENUM ('PROCESSING', 'READY', 'COMMITTED', 'REVERSED', 'FAILED');

-- AlterTable
ALTER TABLE "PantryTransaction" ADD COLUMN     "receiptScanId" TEXT;

-- CreateTable
CREATE TABLE "ReceiptScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ReceiptOcrProvider" NOT NULL,
    "status" "ReceiptScanStatus" NOT NULL DEFAULT 'PROCESSING',
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "committedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptScan_userId_createdAt_idx" ON "ReceiptScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PantryTransaction_receiptScanId_idx" ON "PantryTransaction"("receiptScanId");

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_receiptScanId_fkey" FOREIGN KEY ("receiptScanId") REFERENCES "ReceiptScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptScan" ADD CONSTRAINT "ReceiptScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

