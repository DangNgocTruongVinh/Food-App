import type { DietType, HealthGoal, MealType, Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { nutritionTargetFields } from "../src/services/nutrition.service.js";
import { vietnamToday } from "../src/utils/vietnam-date.js";

// Tài khoản mẫu minh họa (GĐ3b-R4, quyết định 3): 8 người "Người dùng mẫu N" (mauN@nouri.vn, User.isSample = true) thuộc
// 3 nhóm khẩu vị, có hồ sơ và tương tác thật tạo bằng seed — đã ăn (thực đơn tuần trước), đăng bài gắn món, thích bài của
// người cùng nhóm — để thuật toán gợi ý cộng tác có dữ liệu khi demo. Mật khẩu ngẫu nhiên, không in ra, không ai đăng nhập.
// Không tính vào thống kê Admin. Đây là dữ liệu minh họa, không phải người dùng thật.

const DAY_MS = 86_400_000;
export const SAMPLE_EMAIL = (index: number) => `mau${index}@nouri.vn`;

type SampleGroup = {
  name: string;
  members: number;
  profile: { dietType: DietType; goal: HealthGoal; preferredCuisines: string[]; allergies?: string[] };
  /** Món cả nhóm hay ăn (theo slug của bộ món seed). */
  favorites: string[];
  /** Món riêng của từng thành viên (vòng qua danh sách). */
  extras: string[];
  post: string;
};

export const SAMPLE_GROUPS: SampleGroup[] = [
  {
    name: "Ăn chay", members: 3,
    profile: { dietType: "VEGETARIAN", goal: "MAINTAIN", preferredCuisines: ["Việt Nam"] },
    favorites: ["bun-xao-chay", "dau-hu-sot-ca-chua", "canh-chua-chay", "nam-kho-tieu", "banh-mi-dau-hu-sa", "che-dau-den"],
    extras: ["com-chien-chay", "xoi-dau-xanh", "khoai-lang-luoc"],
    post: "Bữa chay nhẹ nhàng hôm nay, cả nhà đều khen.",
  },
  {
    name: "Tập luyện, giàu đạm", members: 3,
    profile: { dietType: "HIGH_PROTEIN", goal: "BUILD_MUSCLE", preferredCuisines: ["Việt Nam", "Nhật Bản"] },
    favorites: ["ga-xao-sa-ot", "bo-xao-bong-cai", "ca-hap-gung-hanh", "chao-ga-hanh-gung", "trung-chien-rau-cu", "ga-teriyaki"],
    extras: ["pho-bo", "com-tam-suon-nuong", "bun-bo-nam-bo"],
    post: "Món này đủ đạm cho buổi tập tối.",
  },
  {
    name: "Thích món quốc tế", members: 2,
    profile: { dietType: "BALANCED", goal: "MAINTAIN", preferredCuisines: ["Ý", "Nhật Bản", "Hàn Quốc", "Thái Lan"], allergies: ["Đậu phộng"] },
    favorites: ["mi-y-sot-bo-bam", "ga-teriyaki", "com-tron-han-quoc", "salad-hy-lap", "yen-mach-qua-dem"],
    extras: ["sinh-to-bo", "canh-bi-do-tom"],
    post: "Đổi gió với món nước ngoài, dễ làm hơn mình nghĩ.",
  },
];

export type SampleMember = { index: number; group: SampleGroup; recipes: string[] };

/** Danh sách thành viên mẫu: mauN theo thứ tự nhóm; mỗi người ăn toàn bộ món của nhóm + 1 món riêng. */
export function sampleMembers(): SampleMember[] {
  let index = 0;
  return SAMPLE_GROUPS.flatMap((group) => Array.from({ length: group.members }, (_, member) => {
    index += 1;
    return { index, group, recipes: [...group.favorites, group.extras[member % group.extras.length]] };
  }));
}

type SampleRecipe = { id: string; slug: string; mealTypes: MealType[]; calories: number };
type Tx = Prisma.TransactionClient;

const profileOf = (group: SampleGroup) => {
  const base = {
    age: 28, gender: "OTHER" as const, heightCm: 165, weightKg: 60, targetWeightKg: 60, activityLevel: "MODERATE" as const,
    goal: group.profile.goal, dietType: group.profile.dietType, allergies: group.profile.allergies ?? [], dislikedFoods: [],
    preferredCuisines: group.profile.preferredCuisines, mealsPerDay: 3,
  };
  return { ...base, ...nutritionTargetFields(base) };
};

/** Mật khẩu ngẫu nhiên (không lưu, không in): băm trước khi mở transaction vì bcrypt chậm. */
export async function samplePasswordHashes(count = sampleMembers().length) {
  return Promise.all(Array.from({ length: count }, () => bcrypt.hash(randomBytes(24).toString("base64url"), 10)));
}

/**
 * Xóa rồi tạo lại toàn bộ tài khoản mẫu (gọi trong transaction của seed hoặc demo:reset). Xóa người dùng mẫu kéo theo thực đơn,
 * bài viết, lượt thích, bình luận của họ (Cascade); thông báo của người thật liên quan tới bài mẫu (không có FK) xóa riêng.
 * Món không còn hoặc đã bị ẩn thì bỏ qua.
 */
export async function rebuildSampleAccounts(tx: Tx, passwordHashes: string[], now = new Date()) {
  const oldPosts = await tx.communityPost.findMany({ where: { author: { isSample: true } }, select: { id: true } });
  if (oldPosts.length) await tx.notification.deleteMany({ where: { relatedId: { in: oldPosts.map((post) => post.id) } } });
  await tx.user.deleteMany({ where: { isSample: true } });

  const members = sampleMembers();
  const slugs = [...new Set(members.flatMap((member) => member.recipes))];
  const rows: SampleRecipe[] = await tx.recipe.findMany({
    where: { slug: { in: slugs }, hiddenAt: null, deletedAt: null }, select: { id: true, slug: true, mealTypes: true, calories: true },
  });
  const bySlug = new Map(rows.map((recipe) => [recipe.slug, recipe]));
  const today = vietnamToday(now);
  const start = new Date(today.getTime() - 8 * DAY_MS);

  const created: Array<{ id: string; member: SampleMember; postId: string | null }> = [];
  for (const member of members) {
    const profile = profileOf(member.group);
    const recipes = member.recipes.map((slug) => bySlug.get(slug)).filter((recipe): recipe is SampleRecipe => Boolean(recipe));
    const user = await tx.user.create({
      data: {
        email: SAMPLE_EMAIL(member.index), name: `Người dùng mẫu ${member.index}`, isSample: true,
        passwordHash: passwordHashes[member.index - 1], profile: { create: profile },
      },
    });
    // Thực đơn tuần trước, đã áp dụng xong: mỗi món của người này là một bữa đã ăn, rải đều 7 ngày.
    await tx.mealPlan.create({
      data: {
        userId: user.id, name: "Thực đơn tuần trước", status: "COMPLETED", aiGenerated: false,
        startDate: start, endDate: new Date(start.getTime() + 6 * DAY_MS), calorieTarget: profile.dailyCalorieTarget,
        summary: "Thực đơn của tài khoản mẫu minh họa.",
        days: {
          create: Array.from({ length: 7 }, (_, dayIndex) => ({
            date: new Date(start.getTime() + dayIndex * DAY_MS),
            items: {
              create: recipes.filter((_, index) => index % 7 === dayIndex).map((recipe) => ({
                recipeId: recipe.id, mealType: recipe.mealTypes[0] ?? "LUNCH", servings: 1, completed: true, calories: recipe.calories,
              })),
            },
          })),
        },
      },
    });
    // Một bài viết gắn món đầu tiên mà người này ăn (xoay vòng trong nhóm để mỗi người một món khác).
    const shared = recipes[(member.index - 1) % Math.max(1, recipes.length)];
    const post = shared
      ? await tx.communityPost.create({
        data: { authorId: user.id, recipeId: shared.id, content: member.group.post, createdAt: new Date(now.getTime() - member.index * 3_600_000) },
      })
      : null;
    created.push({ id: user.id, member, postId: post?.id ?? null });
  }
  // Mỗi người thích bài của những người cùng nhóm.
  const likes = created.flatMap((liker) => created
    .filter((author) => author.member.group === liker.member.group && author.id !== liker.id && author.postId)
    .map((author) => ({ postId: author.postId!, userId: liker.id })));
  if (likes.length) await tx.communityLike.createMany({ data: likes });
  return { accounts: created.length, posts: created.filter((entry) => entry.postId).length, likes: likes.length };
}

type SampleClient = Pick<PrismaClient, "user" | "$transaction">;

/** Seed: chỉ tạo khi còn thiếu tài khoản mẫu (không ghi đè lượt thích người thật đã bấm lên bài mẫu); đủ rồi thì giữ nguyên. */
export async function seedSampleAccounts(client: SampleClient, now = new Date()) {
  const existing = await client.user.count({ where: { isSample: true } });
  if (existing >= sampleMembers().length) return null;
  const hashes = await samplePasswordHashes();
  return client.$transaction((tx) => rebuildSampleAccounts(tx, hashes, now), { timeout: 30_000 });
}
