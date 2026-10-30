import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readSeedEnv } from "../src/config/seed-env.js";
import { nutritionTargetFields } from "../src/services/nutrition.service.js";
import { seedRecipes } from "./seed-data.js";
import { seedAdminAccount, seedRecipeCatalog } from "./seed-steps.js";

const prisma = new PrismaClient();

async function main() {
  const options = readSeedEnv();
  // Không xóa và (mặc định) không ghi đè công thức: Admin có thể đã sửa món gốc hoặc thêm món mới.
  const recipes = await seedRecipeCatalog(prisma, seedRecipes, options.updateRecipes);
  console.log(`Công thức: tạo mới ${recipes.created}, cập nhật ${recipes.updated}, giữ nguyên ${recipes.skipped}.`);

  if (options.admin) {
    const result = await seedAdminAccount(prisma, options.admin);
    console.log(`Tài khoản Admin ${options.admin.email}: ${result === "created" ? "đã tạo" : "đã có, giữ mật khẩu cũ, đặt quyền ADMIN"}.`);
  } else {
    console.warn("Bỏ qua tạo tài khoản Admin: chưa khai báo ADMIN_EMAIL và ADMIN_PASSWORD.");
  }

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
