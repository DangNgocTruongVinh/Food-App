import { PrismaClient } from "@prisma/client";
import { readSeedEnv } from "../src/config/seed-env.js";
import { seedCatalog } from "../src/services/catalog/catalog.service.js";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoAccount } from "./demo-account.js";
import { seedRecipes } from "./seed-data.js";
import { seedSampleAccounts } from "./sample-accounts.js";
import { seedAdminAccount, seedRecipeCatalog } from "./seed-steps.js";

const prisma = new PrismaClient();

async function main() {
  const options = readSeedEnv();
  // Không xóa và (mặc định) không ghi đè công thức: Admin có thể đã sửa món gốc hoặc thêm món mới.
  const catalog = await seedCatalog(prisma);
  console.log("Danh mục dữ liệu (dòng mới tạo):", JSON.stringify(catalog));
  const recipes = await seedRecipeCatalog(prisma, seedRecipes, options.updateRecipes);
  console.log(`Công thức: tạo mới ${recipes.created}, cập nhật ${recipes.updated}, giữ nguyên ${recipes.skipped}.`);

  if (options.admin) {
    const result = await seedAdminAccount(prisma, options.admin);
    console.log(`Tài khoản Admin ${options.admin.email}: ${result === "created" ? "đã tạo" : "đã có, giữ mật khẩu cũ, đặt quyền ADMIN"}.`);
  } else {
    console.warn("Bỏ qua tạo tài khoản Admin: chưa khai báo ADMIN_EMAIL và ADMIN_PASSWORD.");
  }

  // Đổi tên nutriplan → nouri: chuyển tài khoản demo cũ sang email mới thay vì tạo thêm tài khoản thứ hai.
  const legacyEmail = "demo@nutriplan.vn";
  if (!(await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })) && (await prisma.user.findUnique({ where: { email: legacyEmail } }))) {
    await prisma.user.update({ where: { email: legacyEmail }, data: { email: DEMO_EMAIL } });
  }
  // Tài khoản mẫu trước: lịch sử mẫu của demo thích bài của họ.
  const samples = await seedSampleAccounts(prisma);
  console.log(samples
    ? `Tài khoản mẫu minh họa: đã tạo ${samples.accounts} tài khoản, ${samples.posts} bài viết, ${samples.likes} lượt thích (mật khẩu ngẫu nhiên, không in).`
    : "Tài khoản mẫu minh họa: đã có đủ, giữ nguyên.");
  const demo = await seedDemoAccount(prisma);
  console.log(demo.pantryCreated
    ? "Kho demo: đã tạo kho mẫu (hạn tính từ hôm nay)."
    : "Kho demo: đã có dữ liệu, giữ nguyên (đặt lại bằng npm run demo:reset -- --yes).");
  if (demo.historyCreated) console.log("Lịch sử mẫu của demo: đã tạo thực đơn 2 tuần trước (dữ liệu mẫu).");
  console.log(`Seed hoàn tất. Demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
