import { buildCollaborativeModel, type CollaborativeModel } from "./collaborative.js";
import { loadCollaborativeInteractions } from "./interactions.js";

// Nạp dữ liệu cho các thuật toán gợi ý (GĐ3b-R). R5 thêm API chung và bộ trộn.

export const COLLABORATIVE_CACHE_MS = 10 * 60_000;
let collaborative: { builtAt: number; model: Promise<CollaborativeModel> } | null = null;

/**
 * Mô hình cộng tác (ma trận r_ui + k hàng xóm của mỗi món) dùng chung cho mọi người dùng, cache 10 phút: tương tác mới
 * (ăn, đăng bài, thích) có hiệu lực ở lần tính lại tiếp theo. Các request đến cùng lúc dùng chung một lần tính.
 */
export function getCollaborativeModel(now = new Date()) {
  if (!collaborative || now.getTime() - collaborative.builtAt >= COLLABORATIVE_CACHE_MS) {
    const model = loadCollaborativeInteractions().then((interactions) => buildCollaborativeModel(interactions, now));
    collaborative = { builtAt: now.getTime(), model };
    model.catch(() => { collaborative = null; });
  }
  return collaborative.model;
}

export function clearRecommendationCache() {
  collaborative = null;
}
