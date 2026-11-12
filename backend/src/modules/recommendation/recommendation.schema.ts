import { z } from "zod";

const empty = z.object({});

// Đủ lớn để "Đổi món khác" ở Tổng quan duyệt hết món phù hợp (bộ món ~33); bộ gợi ý vốn chấm điểm mọi món rồi mới cắt.
export const RECOMMENDATION_LIMIT_MAX = 50;

/** GET /api/recommendations: "similar"/"also-cooked" cần recipeId; pantryItemId chỉ dùng với ngữ cảnh "pantry". */
export const recommendationsSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    context: z.enum(["today", "for-you", "pantry", "similar", "also-cooked"]),
    recipeId: z.string().cuid().optional(),
    pantryItemId: z.string().cuid().optional(),
    mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).optional(),
    limit: z.coerce.number().int().min(1).max(RECOMMENDATION_LIMIT_MAX).default(6),
  }).strict()
    .refine((query) => !["similar", "also-cooked"].includes(query.context) || query.recipeId, {
      message: "Ngữ cảnh này cần recipeId.", path: ["recipeId"],
    })
    .refine((query) => !query.pantryItemId || query.context === "pantry", {
      message: "pantryItemId chỉ dùng với ngữ cảnh pantry.", path: ["pantryItemId"],
    }),
});

export type RecommendationsQuery = z.infer<typeof recommendationsSchema>["query"];
