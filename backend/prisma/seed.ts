import { PrismaClient, type DietType, type FoodUnit } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedRecipe = {
  slug: string; name: string; description: string; prepMinutes: number; cookMinutes: number;
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
  cuisine: string; dietTags: DietType[]; instructions: string[];
  ingredients: Array<{ name: string; quantity: number; unit: FoodUnit }>;
};

const recipes: SeedRecipe[] = [
  { slug: "overnight-oats-banana", name: "Yến mạch chuối qua đêm", description: "Bữa sáng nhanh, giàu chất xơ và no lâu.", prepMinutes: 8, cookMinutes: 0, calories: 410, proteinG: 17, carbsG: 64, fatG: 11, fiberG: 9, cuisine: "Quốc tế", dietTags: ["BALANCED", "VEGETARIAN"], instructions: ["Trộn yến mạch với sữa chua và sữa.", "Để lạnh qua đêm.", "Thêm chuối trước khi dùng."], ingredients: [{ name: "Yến mạch", quantity: 60, unit: "G" }, { name: "Chuối", quantity: 1, unit: "ITEM" }, { name: "Sữa chua", quantity: 100, unit: "G" }, { name: "Sữa tươi", quantity: 120, unit: "ML" }] },
  { slug: "egg-avocado-toast", name: "Bánh mì trứng bơ", description: "Protein, chất béo tốt và tinh bột cho buổi sáng năng động.", prepMinutes: 5, cookMinutes: 8, calories: 430, proteinG: 20, carbsG: 37, fatG: 23, fiberG: 8, cuisine: "Quốc tế", dietTags: ["BALANCED", "VEGETARIAN", "HIGH_PROTEIN"], instructions: ["Áp chảo trứng.", "Nghiền bơ với chút tiêu.", "Phết bơ và đặt trứng lên bánh mì."], ingredients: [{ name: "Bánh mì nguyên cám", quantity: 2, unit: "ITEM" }, { name: "Trứng", quantity: 2, unit: "ITEM" }, { name: "Bơ", quantity: 0.5, unit: "ITEM" }] },
  { slug: "chicken-brown-rice", name: "Cơm gạo lứt ức gà", description: "Bữa trưa giàu đạm, cân bằng cùng rau củ nhiều màu sắc.", prepMinutes: 15, cookMinutes: 25, calories: 560, proteinG: 48, carbsG: 62, fatG: 13, fiberG: 7, cuisine: "Việt Nam", dietTags: ["BALANCED", "HIGH_PROTEIN"], instructions: ["Ướp và áp chảo ức gà.", "Luộc bông cải vừa chín.", "Dùng cùng cơm gạo lứt."], ingredients: [{ name: "Ức gà", quantity: 180, unit: "G" }, { name: "Gạo lứt", quantity: 90, unit: "G" }, { name: "Bông cải xanh", quantity: 150, unit: "G" }, { name: "Cà rốt", quantity: 80, unit: "G" }] },
  { slug: "salmon-sweet-potato", name: "Cá hồi khoai lang", description: "Omega-3 từ cá hồi kết hợp tinh bột chậm và rau xanh.", prepMinutes: 12, cookMinutes: 22, calories: 590, proteinG: 39, carbsG: 48, fatG: 27, fiberG: 8, cuisine: "Quốc tế", dietTags: ["BALANCED", "HIGH_PROTEIN"], instructions: ["Nướng cá hồi với tiêu.", "Hấp khoai lang.", "Trộn salad và dùng cùng cá."], ingredients: [{ name: "Cá hồi", quantity: 160, unit: "G" }, { name: "Khoai lang", quantity: 200, unit: "G" }, { name: "Xà lách", quantity: 100, unit: "G" }, { name: "Cà chua", quantity: 1, unit: "ITEM" }] },
  { slug: "tofu-mushroom-rice", name: "Đậu hũ nấm sốt gừng", description: "Món chay thanh vị, đủ đạm thực vật và dễ chuẩn bị.", prepMinutes: 12, cookMinutes: 15, calories: 470, proteinG: 25, carbsG: 54, fatG: 19, fiberG: 6, cuisine: "Việt Nam", dietTags: ["BALANCED", "VEGETARIAN", "VEGAN"], instructions: ["Áp chảo đậu hũ.", "Xào nấm với gừng.", "Thêm đậu hũ và sốt, dùng cùng cơm."], ingredients: [{ name: "Đậu hũ", quantity: 200, unit: "G" }, { name: "Nấm", quantity: 150, unit: "G" }, { name: "Gạo", quantity: 80, unit: "G" }, { name: "Gừng", quantity: 10, unit: "G" }] },
  { slug: "beef-noodle-salad", name: "Bún bò Nam Bộ nhẹ", description: "Bún trộn nhiều rau, thịt bò nạc và nước mắm chua ngọt vừa phải.", prepMinutes: 18, cookMinutes: 12, calories: 540, proteinG: 36, carbsG: 67, fatG: 15, fiberG: 6, cuisine: "Việt Nam", dietTags: ["BALANCED", "HIGH_PROTEIN"], instructions: ["Ướp và xào nhanh thịt bò.", "Sơ chế bún và rau.", "Trộn cùng nước mắm pha loãng."], ingredients: [{ name: "Thịt bò", quantity: 150, unit: "G" }, { name: "Bún", quantity: 180, unit: "G" }, { name: "Xà lách", quantity: 100, unit: "G" }, { name: "Dưa leo", quantity: 1, unit: "ITEM" }] },
  { slug: "shrimp-pumpkin-soup", name: "Canh bí đỏ nấu tôm", description: "Món canh ấm bụng, giàu beta-carotene và đạm nạc.", prepMinutes: 10, cookMinutes: 18, calories: 330, proteinG: 28, carbsG: 35, fatG: 9, fiberG: 5, cuisine: "Việt Nam", dietTags: ["BALANCED", "HIGH_PROTEIN"], instructions: ["Xào sơ tôm.", "Nấu bí đỏ đến mềm.", "Cho tôm vào, nêm nhạt và thêm hành."], ingredients: [{ name: "Bí đỏ", quantity: 250, unit: "G" }, { name: "Tôm", quantity: 140, unit: "G" }, { name: "Hành lá", quantity: 10, unit: "G" }] },
  { slug: "vegan-buddha-bowl", name: "Buddha bowl đậu gà", description: "Tô rau củ thuần chay giàu chất xơ và màu sắc.", prepMinutes: 15, cookMinutes: 20, calories: 510, proteinG: 21, carbsG: 72, fatG: 18, fiberG: 16, cuisine: "Quốc tế", dietTags: ["VEGETARIAN", "VEGAN", "BALANCED"], instructions: ["Nướng khoai và đậu gà.", "Sơ chế rau.", "Xếp vào tô và thêm sốt mè."], ingredients: [{ name: "Đậu gà", quantity: 160, unit: "G" }, { name: "Khoai lang", quantity: 150, unit: "G" }, { name: "Bông cải xanh", quantity: 120, unit: "G" }, { name: "Bơ", quantity: 0.5, unit: "ITEM" }] },
  { slug: "greek-yogurt-fruit", name: "Sữa chua trái cây hạt", description: "Bữa phụ mát nhẹ với protein và chất béo không bão hòa.", prepMinutes: 5, cookMinutes: 0, calories: 260, proteinG: 16, carbsG: 31, fatG: 9, fiberG: 5, cuisine: "Quốc tế", dietTags: ["BALANCED", "VEGETARIAN", "HIGH_PROTEIN"], instructions: ["Cho sữa chua vào tô.", "Thêm trái cây cắt nhỏ và hạt."], ingredients: [{ name: "Sữa chua Hy Lạp", quantity: 170, unit: "G" }, { name: "Táo", quantity: 1, unit: "ITEM" }, { name: "Hạt điều", quantity: 15, unit: "G" }] },
  { slug: "chicken-pho", name: "Phở gà rau thơm", description: "Phở gà phiên bản nhẹ với phần thịt nạc và nhiều rau thơm.", prepMinutes: 15, cookMinutes: 25, calories: 490, proteinG: 38, carbsG: 60, fatG: 11, fiberG: 4, cuisine: "Việt Nam", dietTags: ["BALANCED", "HIGH_PROTEIN"], instructions: ["Nấu nước dùng gừng hành.", "Luộc và xé thịt gà.", "Chần phở, thêm gà và rau thơm."], ingredients: [{ name: "Ức gà", quantity: 150, unit: "G" }, { name: "Bánh phở", quantity: 180, unit: "G" }, { name: "Giá", quantity: 80, unit: "G" }, { name: "Hành lá", quantity: 10, unit: "G" }] },
  { slug: "vegetable-omelette", name: "Trứng cuộn rau củ", description: "Món nhanh gọn, giàu đạm cho sáng hoặc tối nhẹ.", prepMinutes: 8, cookMinutes: 10, calories: 350, proteinG: 25, carbsG: 16, fatG: 22, fiberG: 4, cuisine: "Việt Nam", dietTags: ["BALANCED", "VEGETARIAN", "LOW_CARB", "HIGH_PROTEIN"], instructions: ["Cắt nhỏ rau củ.", "Đánh trứng và trộn rau.", "Áp chảo lửa vừa rồi cuộn lại."], ingredients: [{ name: "Trứng", quantity: 3, unit: "ITEM" }, { name: "Cà rốt", quantity: 50, unit: "G" }, { name: "Nấm", quantity: 70, unit: "G" }, { name: "Hành lá", quantity: 10, unit: "G" }] },
  { slug: "tuna-lettuce-wrap", name: "Cuốn xà lách cá ngừ", description: "Bữa tối ít tinh bột, giàu protein và giòn mát.", prepMinutes: 12, cookMinutes: 0, calories: 380, proteinG: 39, carbsG: 19, fatG: 18, fiberG: 7, cuisine: "Quốc tế", dietTags: ["LOW_CARB", "HIGH_PROTEIN", "BALANCED"], instructions: ["Trộn cá ngừ với bơ nghiền.", "Thêm dưa leo thái hạt lựu.", "Cuốn hỗn hợp trong lá xà lách."], ingredients: [{ name: "Cá ngừ", quantity: 160, unit: "G" }, { name: "Xà lách", quantity: 120, unit: "G" }, { name: "Bơ", quantity: 0.5, unit: "ITEM" }, { name: "Dưa leo", quantity: 1, unit: "ITEM" }] },
];

async function main() {
  for (const recipe of recipes) {
    const { ingredients, ...data } = recipe;
    await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: { ...data, ingredients: { deleteMany: {}, create: ingredients } },
      create: { ...data, ingredients: { create: ingredients } },
    });
  }

  const email = "demo@nutriplan.vn";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email, name: "Minh Anh", passwordHash: await bcrypt.hash("Demo@123", 12),
      profile: { create: { age: 24, gender: "FEMALE", heightCm: 162, weightKg: 55, targetWeightKg: 53, activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED", allergies: [], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam", "Nhật Bản"], mealsPerDay: 3, dailyCalorieTarget: 1880, proteinTargetG: 118, carbTargetG: 221, fatTargetG: 58 } },
    },
  });
  if (!(await prisma.pantryItem.count({ where: { userId: user.id } }))) {
    const day = 86_400_000;
    await prisma.pantryItem.createMany({ data: [
      { userId: user.id, name: "Ức gà", category: "Thịt & cá", quantity: 500, unit: "G", expiryDate: new Date(Date.now() + 2 * day) },
      { userId: user.id, name: "Bông cải xanh", category: "Rau củ", quantity: 300, unit: "G", expiryDate: new Date(Date.now() + 3 * day) },
      { userId: user.id, name: "Trứng", category: "Trứng & sữa", quantity: 8, unit: "ITEM", expiryDate: new Date(Date.now() + 10 * day) },
      { userId: user.id, name: "Khoai lang", category: "Rau củ", quantity: 600, unit: "G", expiryDate: new Date(Date.now() + 8 * day) },
      { userId: user.id, name: "Gạo lứt", category: "Ngũ cốc", quantity: 1000, unit: "G", expiryDate: new Date(Date.now() + 60 * day) },
    ] });
  }
  console.log("Seed hoàn tất. Demo: demo@nutriplan.vn / Demo@123");
}

main().finally(() => prisma.$disconnect());
