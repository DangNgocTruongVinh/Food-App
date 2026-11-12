import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { openAIClient } from "../ai/openai.service.js";
import { createRecipeEstimator } from "../ai/recipe-estimate.js";
import { readMemberRecipe } from "../community/community-member-recipe.js";

// POST /api/admin/community/posts/:postId/recipe-estimate: AI điền sẵn dinh dưỡng + tên nguyên liệu cho form "Chuyển thành
// công thức". Không ghi DB (Admin lưu bằng form như thường nên không có nhật ký riêng). Không có key/lỗi API → 503 kèm code.

const estimateRecipe = createRecipeEstimator(openAIClient, env.OPENAI_MODEL);

export async function estimateRecipeFromPost(postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { memberRecipe: true } });
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");
  const recipe = readMemberRecipe(post.memberRecipe);
  if (!recipe) throw new HttpError(422, "Bài viết này không có công thức tự viết để chuyển.");
  const rows = await prisma.recipeIngredient.findMany({ distinct: ["name"], select: { name: true } });
  let estimate;
  try {
    estimate = await estimateRecipe(recipe, rows.map((row) => row.name));
  } catch (error) {
    console.error("AI ước tính công thức lỗi:", error instanceof Error ? error.message : error);
    throw new HttpError(503, "AI chưa ước tính được, vui lòng tự điền dinh dưỡng.", { code: "AI_UNAVAILABLE" });
  }
  if (!estimate) throw new HttpError(503, "Chưa cấu hình OpenAI nên không ước tính tự động được.", { code: "AI_NOT_CONFIGURED" });
  return estimate;
}
