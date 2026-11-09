-- CreateEnum
CREATE TYPE "PantryTransactionSource" AS ENUM ('CONSUMPTION', 'PURCHASE', 'MANUAL_ADD', 'MANUAL_EDIT', 'MANUAL_DELETE', 'RECEIPT_SCAN');

-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "expiryEstimated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PantryTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pantryItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "unit" "FoodUnit" NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "source" "PantryTransactionSource" NOT NULL,
    "note" TEXT,
    "mealPlanItemId" TEXT,
    "shoppingItemId" TEXT,
    "reversalOfId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryTransaction_userId_createdAt_idx" ON "PantryTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PantryTransaction_pantryItemId_createdAt_idx" ON "PantryTransaction"("pantryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PantryTransaction_mealPlanItemId_idx" ON "PantryTransaction"("mealPlanItemId");

-- CreateIndex
CREATE INDEX "PantryTransaction_shoppingItemId_idx" ON "PantryTransaction"("shoppingItemId");

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_mealPlanItemId_fkey" FOREIGN KEY ("mealPlanItemId") REFERENCES "MealPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_shoppingItemId_fkey" FOREIGN KEY ("shoppingItemId") REFERENCES "ShoppingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryTransaction" ADD CONSTRAINT "PantryTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "PantryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

