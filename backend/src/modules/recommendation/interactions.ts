// Tương tác người dùng × món (GĐ3b-R), suy ra từ bảng có sẵn, không có bảng sự kiện riêng:
//   EATEN  — bữa đã đánh dấu đã ăn (MealPlanItem.completed), thời điểm = ngày của bữa;
//   POSTED — đăng bài cộng đồng gắn món; LIKED — thích bài người khác có gắn món;
//   PLANNED — món có trong thực đơn (không phải bản nháp) nhưng chưa ăn: chỉ dùng cho thuật toán 1. Thực đơn do hệ thống
//   tự xếp, nên đưa tín hiệu này vào thuật toán 2 sẽ tạo vòng lặp phản hồi (món được gợi ý → vào thực đơn → được gợi ý nhiều hơn).

export type InteractionKind = "EATEN" | "POSTED" | "LIKED" | "PLANNED";
export type CollaborativeKind = Exclude<InteractionKind, "PLANNED">;
/** `count` = số lần cùng loại, cùng ngày (đã gom ở SQL). */
export type Interaction<K extends InteractionKind = InteractionKind> = { userId: string; recipeId: string; kind: K; at: Date; count: number };

export const CONTENT_WEIGHTS: Record<InteractionKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2, PLANNED: 0.5 };
export const COLLABORATIVE_WEIGHTS: Record<CollaborativeKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2 };
export const DECAY_TAU_DAYS = 30;
const DAY_MS = 86_400_000;

/** e^(−Δ/τ), Δ = số ngày từ lúc tương tác tới nay (tương tác ở tương lai, vd. bữa đã ăn sớm, tính Δ = 0). */
export function decay(at: Date, now: Date, tauDays = DECAY_TAU_DAYS) {
  return Math.exp(-Math.max(0, (now.getTime() - at.getTime()) / DAY_MS) / tauDays);
}
