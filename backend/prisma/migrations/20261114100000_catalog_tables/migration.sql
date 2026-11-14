-- CreateEnum
CREATE TYPE "AllergenTermLevel" AS ENUM ('CONTAINS', 'MAY_CONTAIN');

-- CreateEnum
CREATE TYPE "FoodTextMatch" AS ENUM ('PREFIX', 'PREFIX_WORD', 'CONTAINS_WORD');

-- CreateEnum
CREATE TYPE "ReceiptKeywordMatch" AS ENUM ('WORD', 'PREFIX', 'LINE', 'LINE_SUFFIX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditAction" ADD VALUE 'CATALOG_CREATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'CATALOG_UPDATE';

-- AlterEnum
ALTER TYPE "AdminAuditTargetType" ADD VALUE 'CATALOG';

-- CreateTable
CREATE TABLE "AllergenGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllergenGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergenAlias" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllergenAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergenTerm" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AllergenTermLevel" NOT NULL DEFAULT 'CONTAINS',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllergenTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergenExclusion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,

    CONSTRAINT "AllergenExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultStorage" "StorageLocation" NOT NULL DEFAULT 'REFRIGERATOR',
    "defaultShelfLifeDays" INTEGER,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodCategoryTerm" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoodCategoryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodShelfLifeRule" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchMode" "FoodTextMatch" NOT NULL DEFAULT 'PREFIX',
    "shelfLifeDays" INTEGER,
    "storage" "StorageLocation" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoodShelfLifeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAbbreviation" (
    "id" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptAbbreviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSkipKeyword" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonOrder" INTEGER NOT NULL,
    "keyword" TEXT NOT NULL,
    "matchMode" "ReceiptKeywordMatch" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptSkipKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllergenGroup_code_key" ON "AllergenGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AllergenGroup_label_key" ON "AllergenGroup"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AllergenAlias_groupId_name_key" ON "AllergenAlias"("groupId", "name");

-- CreateIndex
CREATE INDEX "AllergenTerm_groupId_sortOrder_idx" ON "AllergenTerm"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AllergenTerm_groupId_name_level_key" ON "AllergenTerm"("groupId", "name", "level");

-- CreateIndex
CREATE UNIQUE INDEX "AllergenExclusion_groupId_phrase_key" ON "AllergenExclusion"("groupId", "phrase");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategory_name_key" ON "FoodCategory"("name");

-- CreateIndex
CREATE INDEX "FoodCategoryTerm_priority_idx" ON "FoodCategoryTerm"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategoryTerm_categoryId_prefix_key" ON "FoodCategoryTerm"("categoryId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "FoodShelfLifeRule_categoryId_pattern_matchMode_key" ON "FoodShelfLifeRule"("categoryId", "pattern", "matchMode");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAbbreviation_abbreviation_key" ON "ReceiptAbbreviation"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSkipKeyword_reason_keyword_matchMode_key" ON "ReceiptSkipKeyword"("reason", "keyword", "matchMode");

-- AddForeignKey
ALTER TABLE "AllergenGroup" ADD CONSTRAINT "AllergenGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AllergenGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergenAlias" ADD CONSTRAINT "AllergenAlias_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AllergenGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergenTerm" ADD CONSTRAINT "AllergenTerm_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AllergenGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergenExclusion" ADD CONSTRAINT "AllergenExclusion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AllergenGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodCategoryTerm" ADD CONSTRAINT "FoodCategoryTerm_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodShelfLifeRule" ADD CONSTRAINT "FoodShelfLifeRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

