import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nutritionTargetFields } from "../src/services/nutrition.service.js";
import { vietnamToday } from "../src/utils/vietnam-date.js";
import { createDemoHistory } from "./demo-history.js";
import { rebuildSampleAccounts, samplePasswordHashes } from "./sample-accounts.js";

// Tài khoản demo (demo@nouri.vn): hồ sơ và kho mẫu. Hạn sử dụng TƯƠNG ĐỐI theo ngày chạy (giờ Việt Nam) để dữ liệu demo
// không "già": luôn có đồ sắp hết hạn, đồ còn hạn dài và một món dưới mức tối thiểu. Chỉ tác động tài khoản demo.

export const DEMO_EMAIL = "demo@nouri.vn";
export const DEMO_PASSWORD = "Demo@123";
export const DEMO_NAME = "Minh Anh";

export const demoProfile = {
  age: 24, gender: "FEMALE", heightCm: 162, weightKg: 55, targetWeightKg: 53, activityLevel: "MODERATE", goal: "MAINTAIN",
  dietType: "BALANCED", allergies: [], dislikedFoods: ["Cần tây"], preferredCuisines: ["Việt Nam", "Nhật Bản"], mealsPerDay: 3,
} satisfies Prisma.NutritionProfileCreateWithoutUserInput;

type DemoPantryTemplate = Omit<Prisma.PantryItemCreateManyInput, "userId" | "expiryDate"> & { expiresInDays: number };

// Tên nguyên liệu trùng tên trong bộ món seed để gợi ý món, "Dành cho bạn" và trừ kho khớp được.
export const demoPantryTemplate: DemoPantryTemplate[] = [
  { name: "Đậu hũ", category: "Đậu & hạt", quantity: 300, unit: "G", storageLocation: "REFRIGERATOR", expiresInDays: 1 },
  { name: "Ức gà", category: "Thịt & cá", quantity: 500, unit: "G", storageLocation: "REFRIGERATOR", expiresInDays: 2 },
  { name: "Bông cải xanh", category: "Rau củ", quantity: 300, unit: "G", storageLocation: "REFRIGERATOR", expiresInDays: 5 },
  { name: "Hành tím", category: "Rau củ", quantity: 150, unit: "G", storageLocation: "DRY_STORAGE", expiresInDays: 7 },
  { name: "Khoai lang", category: "Rau củ", quantity: 600, unit: "G", storageLocation: "DRY_STORAGE", expiresInDays: 8 },
  { name: "Gừng", category: "Gia vị", quantity: 0.2, unit: "KG", storageLocation: "REFRIGERATOR", expiresInDays: 10 },
  // Dưới mức tối thiểu: còn 4 quả, mức tối thiểu 6.
  { name: "Trứng", category: "Trứng & sữa", quantity: 4, unit: "ITEM", storageLocation: "REFRIGERATOR", minimumStock: 6, expiresInDays: 10 },
  { name: "Gạo", category: "Ngũ cốc", quantity: 2, unit: "KG", storageLocation: "DRY_STORAGE", expiresInDays: 90 },
];

export { vietnamToday };

export function demoPantryItems(userId: string, now = new Date()): Prisma.PantryItemCreateManyInput[] {
  const today = vietnamToday(now);
  return demoPantryTemplate.map(({ expiresInDays, ...item }) => ({
    ...item, userId, expiryDate: new Date(today.getTime() + expiresInDays * 86_400_000), purchasedAt: now,
  }));
}

type DemoClient = Pick<PrismaClient, "user" | "nutritionProfile" | "pantryItem" | "mealPlan" | "recipe" | "communityPost" | "communityLike">;

/**
 * Seed: tạo tài khoản demo nếu chưa có (kèm hồ sơ mẫu); kho mẫu chỉ tạo khi kho demo đang trống, kèm lịch sử mẫu 2 tuần
 * (demo-history.ts) nếu demo chưa có thực đơn nào. Không ghi đè hồ sơ, kho hay thực đơn demo đã có (người dùng có thể đang thử),
 * chỉ tính lại 4 chỉ tiêu từ chính hồ sơ đó. Gọi sau khi đã tạo tài khoản mẫu (lịch sử mẫu thích bài của họ).
 */
export async function seedDemoAccount(client: DemoClient, now = new Date()) {
  const user = await client.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      profile: { create: { ...demoProfile, ...nutritionTargetFields(demoProfile) } },
    },
  });
  const profile = await client.nutritionProfile.findUnique({ where: { userId: user.id } });
  if (profile) await client.nutritionProfile.update({ where: { userId: user.id }, data: nutritionTargetFields(profile) });
  else await client.nutritionProfile.create({ data: { userId: user.id, ...demoProfile, ...nutritionTargetFields(demoProfile) } });
  const pantryCreated = !(await client.pantryItem.count({ where: { userId: user.id } }));
  if (pantryCreated) await client.pantryItem.createMany({ data: demoPantryItems(user.id, now) });
  const historyCreated = pantryCreated && !(await client.mealPlan.count({ where: { userId: user.id } }));
  if (historyCreated) await createDemoHistory(client, user.id, now);
  return { userId: user.id, pantryCreated, historyCreated };
}

type ResetClient = Pick<PrismaClient, "user" | "$transaction">;

/**
 * Đặt lại tài khoản demo về trạng thái chuẩn (chạy trước buổi demo). Chỉ xóa dữ liệu CỦA demo: thực đơn, bài viết (kèm
 * bình luận/lượt thích/ảnh), bình luận và lượt thích của demo trên bài người khác, tin nhắn, lịch sử kho, thông báo, kho;
 * rồi tạo lại hồ sơ và kho mẫu, mở khóa, đặt lại tên và mật khẩu demo. Tạo lại luôn các tài khoản mẫu minh họa (GĐ3b-R4,
 * `sample-accounts.ts`) rồi lịch sử mẫu 2 tuần của demo (`demo-history.ts`). Không đụng tới món ăn, Admin, nhật ký Admin.
 * Trả về publicId ảnh bài viết đã xóa để xóa trên Cloudinary sau khi transaction thành công.
 */
export async function resetDemoAccount(
  client: ResetClient, now = new Date(), samples = { hashes: samplePasswordHashes, rebuild: rebuildSampleAccounts },
  history = createDemoHistory,
) {
  const existing = await client.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const sampleHashes = await samples.hashes();
  return client.$transaction(async (tx) => {
    const user = existing ?? await tx.user.create({ data: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash } });
    const userId = user.id;
    const posts = await tx.communityPost.findMany({ where: { authorId: userId }, select: { id: true, images: { select: { publicId: true } } } });
    const postIds = posts.map((post) => post.id);
    const removed = {
      // Thông báo của demo, và thông báo của người khác liên quan tới bài của demo (không có FK tới bài viết).
      notifications: (await tx.notification.deleteMany({ where: { OR: [{ userId }, { relatedId: { in: postIds } }] } })).count,
      chatMessages: (await tx.chatMessage.deleteMany({ where: { userId } })).count,
      pantryTransactions: (await tx.pantryTransaction.deleteMany({ where: { userId } })).count,
      mealPlans: (await tx.mealPlan.deleteMany({ where: { userId } })).count,
      likes: (await tx.communityLike.deleteMany({ where: { userId } })).count,
      comments: (await tx.communityComment.deleteMany({ where: { authorId: userId } })).count,
      posts: (await tx.communityPost.deleteMany({ where: { authorId: userId } })).count,
      pantryItems: (await tx.pantryItem.deleteMany({ where: { userId } })).count,
    };
    await tx.user.update({ where: { id: userId }, data: { name: DEMO_NAME, passwordHash, lockedAt: null, role: "USER" } });
    const profileData = { ...demoProfile, ...nutritionTargetFields(demoProfile) };
    await tx.nutritionProfile.upsert({ where: { userId }, update: profileData, create: { userId, ...profileData } });
    const pantry = await tx.pantryItem.createMany({ data: demoPantryItems(userId, now) });
    const sampleAccounts = await samples.rebuild(tx, sampleHashes, now);
    const demoHistory = await history(tx, userId, now);
    return {
      userId, removed, pantryItems: pantry.count, sampleAccounts, demoHistory,
      imagePublicIds: posts.flatMap((post) => post.images.map((image) => image.publicId)),
    };
  }, { timeout: 30_000 });
}

/** Lệnh đặt lại chỉ chạy khi có --yes (-y), hoặc người dùng gõ đúng câu xác nhận ở terminal tương tác. */
export async function confirmReset(args: string[], interactive: boolean, ask: (question: string) => Promise<string>) {
  if (args.includes("--yes") || args.includes("-y")) return true;
  if (!interactive) return false;
  const answer = await ask(`Xóa toàn bộ thực đơn, bài viết, tin nhắn, lịch sử kho, thông báo, kho của ${DEMO_EMAIL} rồi tạo lại dữ liệu mẫu? Gõ "dat lai" để tiếp tục: `);
  return answer.trim().toLowerCase() === "dat lai";
}
