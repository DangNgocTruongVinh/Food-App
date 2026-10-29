-- Bữa ăn phù hợp của mỗi công thức, để thuật toán dự phòng xếp món đúng bữa.
-- Công thức cũ nhận mảng rỗng (được xếp vào mọi bữa như trước).
ALTER TABLE "Recipe" ADD COLUMN "mealTypes" "MealType"[] NOT NULL DEFAULT ARRAY[]::"MealType"[];
