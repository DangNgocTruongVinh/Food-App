import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nutritionTargetFields } from "../src/services/nutrition.service.js";
import { seedRecipes } from "./seed-data.js";

const prisma = new PrismaClient();

async function main() {
  for (const recipe of seedRecipes) {
    const { ingredients, ...data } = recipe;
    await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: { ...data, servings: 1, ingredients: { deleteMany: {}, create: ingredients } },
      create: { ...data, servings: 1, ingredients: { create: ingredients } },
    });
  }
  // Bộ món cũ: xóa các công thức không còn trong seed và chưa được thực đơn nào dùng.
  // (Công thức đã nằm trong thực đơn được giữ lại; reset database để bỏ hẳn dữ liệu cũ.)
  await prisma.recipe.deleteMany({ where: { slug: { notIn: seedRecipes.map((recipe) => recipe.slug) }, mealItems: { none: {} } } });

  const email = "demo@nouri.vn";
  // Đổi tên nutriplan → nouri: chuyển tài khoản demo cũ sang email mới thay vì tạo thêm tài khoản thứ hai.
  const legacyEmail = "demo@nutriplan.vn";
  if (!(await prisma.user.findUnique({ where: { email } })) && (await prisma.user.findUnique({ where: { email: legacyEmail } }))) {
    await prisma.user.update({ where: { email: legacyEmail }, data: { email } });
  }
  const demoProfile = {
    age: 24, gender: "FEMALE", heightCm: 162, weightKg: 55, targetWeightKg: 53, activityLevel: "MODERATE", goal: "MAINTAIN",
    dietType: "BALANCED", allergies: [], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam", "Nhật Bản"], mealsPerDay: 3,
  } satisfies Prisma.NutritionProfileCreateWithoutUserInput;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email, name: "Minh Anh", passwordHash: await bcrypt.hash("Demo@123", 12),
      profile: { create: { ...demoProfile, ...nutritionTargetFields(demoProfile) } },
    },
  });
  // Chạy lại seed: không ghi đè lựa chọn người dùng đã đổi trong hồ sơ, chỉ tính lại 4 chỉ tiêu từ chính hồ sơ đó.
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId: user.id } });
  if (profile) await prisma.nutritionProfile.update({ where: { userId: user.id }, data: nutritionTargetFields(profile) });
  else await prisma.nutritionProfile.create({ data: { userId: user.id, ...demoProfile, ...nutritionTargetFields(demoProfile) } });
  if (!(await prisma.pantryItem.count({ where: { userId: user.id } }))) {
    const day = 86_400_000;
    await prisma.pantryItem.createMany({ data: [
      { userId: user.id, name: "Ức gà", category: "Thịt & cá", quantity: 500, unit: "G", expiryDate: new Date(Date.now() + 2 * day) },
      { userId: user.id, name: "Bông cải xanh", category: "Rau củ", quantity: 300, unit: "G", expiryDate: new Date(Date.now() + 3 * day) },
      { userId: user.id, name: "Trứng", category: "Trứng & sữa", quantity: 8, unit: "ITEM", expiryDate: new Date(Date.now() + 10 * day) },
      { userId: user.id, name: "Khoai lang", category: "Rau củ", quantity: 600, unit: "G", expiryDate: new Date(Date.now() + 8 * day) },
      { userId: user.id, name: "Gạo", category: "Ngũ cốc", quantity: 1000, unit: "G", expiryDate: new Date(Date.now() + 60 * day) },
    ] });
  }
  console.log(`Seed hoàn tất. Demo: ${email} / Demo@123`);
}

main().finally(() => prisma.$disconnect());
