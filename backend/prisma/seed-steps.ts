import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { seedRecipes as SeedRecipeList } from "./seed-data.js";

type SeedClient = Pick<PrismaClient, "recipe" | "user">;
type SeedRecipe = (typeof SeedRecipeList)[number];

/**
 * Món gốc của seed: mặc định chỉ tạo món còn thiếu, không sửa và không xóa món đã có (Admin có thể đã sửa/thêm món).
 * updateExisting (SEED_UPDATE_RECIPES=true) cố ý ghi đè các món gốc theo seed-data.ts; món do Admin tạo không bị đụng tới.
 */
export async function seedRecipeCatalog(client: SeedClient, recipes: readonly SeedRecipe[], updateExisting: boolean) {
  const result = { created: 0, updated: 0, skipped: 0 };
  for (const recipe of recipes) {
    const { ingredients, ...data } = recipe;
    const existing = await client.recipe.findUnique({ where: { slug: recipe.slug }, select: { id: true } });
    if (!existing) {
      await client.recipe.create({ data: { ...data, servings: 1, ingredients: { create: ingredients } } });
      result.created += 1;
    } else if (updateExisting) {
      await client.recipe.update({
        where: { slug: recipe.slug },
        data: { ...data, servings: 1, ingredients: { deleteMany: {}, create: ingredients } },
      });
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }
  return result;
}

/**
 * Tài khoản Admin từ ADMIN_EMAIL/ADMIN_PASSWORD: tạo mới nếu chưa có; email đã tồn tại thì chỉ nâng quyền ADMIN
 * (và mở khóa), không đổi mật khẩu. Không bao giờ in mật khẩu.
 */
export async function seedAdminAccount(client: SeedClient, admin: { email: string; password: string }) {
  const existing = await client.user.findUnique({ where: { email: admin.email }, select: { id: true } });
  if (existing) {
    await client.user.update({ where: { email: admin.email }, data: { role: "ADMIN", lockedAt: null } });
    return "promoted" as const;
  }
  await client.user.create({
    data: {
      email: admin.email, name: "Quản trị viên", role: "ADMIN",
      passwordHash: await bcrypt.hash(admin.password, 12), profile: { create: {} },
    },
  });
  return "created" as const;
}
