CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');
CREATE TYPE "HealthGoal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT', 'BUILD_MUSCLE');
CREATE TYPE "DietType" AS ENUM ('BALANCED', 'VEGETARIAN', 'VEGAN', 'LOW_CARB', 'HIGH_PROTEIN');
CREATE TYPE "FoodUnit" AS ENUM ('G', 'KG', 'ML', 'L', 'ITEM', 'PACKAGE');
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "age" INTEGER,
  "gender" "Gender",
  "heightCm" DOUBLE PRECISION,
  "weightKg" DOUBLE PRECISION,
  "targetWeightKg" DOUBLE PRECISION,
  "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
  "goal" "HealthGoal" NOT NULL DEFAULT 'MAINTAIN',
  "dietType" "DietType" NOT NULL DEFAULT 'BALANCED',
  "allergies" TEXT[],
  "dislikedFoods" TEXT[],
  "preferredCuisines" TEXT[],
  "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
  "dailyCalorieTarget" INTEGER,
  "proteinTargetG" INTEGER,
  "carbTargetG" INTEGER,
  "fatTargetG" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NutritionProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PantryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" "FoodUnit" NOT NULL,
  "expiryDate" TIMESTAMP(3),
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipe" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "instructions" TEXT[],
  "prepMinutes" INTEGER NOT NULL,
  "cookMinutes" INTEGER NOT NULL,
  "servings" INTEGER NOT NULL DEFAULT 1,
  "calories" INTEGER NOT NULL,
  "proteinG" DOUBLE PRECISION NOT NULL,
  "carbsG" DOUBLE PRECISION NOT NULL,
  "fatG" DOUBLE PRECISION NOT NULL,
  "fiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dietTags" "DietType"[],
  "cuisine" TEXT NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeIngredient" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" "FoodUnit" NOT NULL,
  "optional" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
  "calorieTarget" INTEGER NOT NULL,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanDay" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanItem" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "mealType" "MealType" NOT NULL,
  "servings" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "calories" INTEGER NOT NULL,
  CONSTRAINT "MealPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShoppingItem" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" "FoodUnit" NOT NULL,
  "purchased" BOOLEAN NOT NULL DEFAULT false,
  "category" TEXT,
  CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "NutritionProfile_userId_key" ON "NutritionProfile"("userId");
CREATE INDEX "PantryItem_userId_expiryDate_idx" ON "PantryItem"("userId", "expiryDate");
CREATE INDEX "PantryItem_userId_category_idx" ON "PantryItem"("userId", "category");
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
CREATE INDEX "Recipe_cuisine_idx" ON "Recipe"("cuisine");
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");
CREATE INDEX "MealPlan_userId_startDate_idx" ON "MealPlan"("userId", "startDate");
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_date_key" ON "MealPlanDay"("mealPlanId", "date");
CREATE INDEX "MealPlanItem_dayId_mealType_idx" ON "MealPlanItem"("dayId", "mealType");
CREATE INDEX "ShoppingItem_mealPlanId_purchased_idx" ON "ShoppingItem"("mealPlanId", "purchased");
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ANALYZE;
