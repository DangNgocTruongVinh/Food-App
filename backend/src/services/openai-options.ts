/**
 * Tham số "reasoning" của Responses API chỉ dành cho model suy luận (họ gpt-5*); model khác (gpt-4o…) báo lỗi nếu nhận tham số
 * này. Một chỗ quyết định cho mọi lời gọi (ước tính công thức, kiểm duyệt cộng đồng, đọc hóa đơn) — đổi họ model chỉ sửa ở đây.
 */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export const isReasoningModel = (model: string) => model.startsWith("gpt-5");

/** Trải vào tham số gọi API: `{ model, ...reasoningOption(model, "low"), input }`. */
export function reasoningOption(model: string, effort: ReasoningEffort): { reasoning?: { effort: ReasoningEffort } } {
  return isReasoningModel(model) ? { reasoning: { effort } } : {};
}
