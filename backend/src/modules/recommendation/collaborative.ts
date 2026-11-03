import { COLLABORATIVE_WEIGHTS, type CollaborativeKind, decay, type Interaction } from "./interactions.js";

// Thuật toán 2 — lọc cộng tác theo món, phản hồi ngầm (GĐ3b-R4).
//   r_ui = ln(1 + Σ_e ω(e)·số lần·e^(−Δ_e/30))                         (ma trận người dùng × món)
//   sim(i, j) = (Σ_u r_ui·r_uj) / (‖r_i‖·‖r_j‖) · n_ij / (n_ij + λ)      (cosine giữa hai cột món, co rút λ = 5;
//               n_ij = số người cùng tương tác với cả i và j, để cặp chỉ 1–2 người không bị thổi phồng)
//   N_k(j) = k = 20 món giống j nhất; dự đoán top-N (Deshpande–Karypis): s2(u, j) = Σ_{i ∈ I_u ∩ N_k(j)} sim(i, j)·r_ui
//   cho món j người dùng chưa tương tác. "Người khác cũng nấu" chỉ hiện cặp có ≥ 3 người khác (không tính người đang xem).
// Chỉ dùng số liệu tổng hợp: kết quả trả ra chỉ có id món và độ tương đồng, không có người dùng nào.

export const SHRINKAGE_LAMBDA = 5;
export const NEIGHBORS_K = 20;
export const MIN_SUPPORT = 3;

export type RatingMatrix = Map<string, Map<string, number>>;
export type Neighbor = { recipeId: string; similarity: number; support: number };
export type CollaborativeModel = { ratings: RatingMatrix; neighbors: Map<string, Neighbor[]> };

/** r_ui từ các tương tác (bỏ qua "có trong thực đơn" nếu lỡ truyền vào). */
export function buildRatings(interactions: Interaction[], now = new Date()): RatingMatrix {
  const sums = new Map<string, Map<string, number>>();
  for (const interaction of interactions) {
    if (!(interaction.kind in COLLABORATIVE_WEIGHTS)) continue;
    const weight = COLLABORATIVE_WEIGHTS[interaction.kind as CollaborativeKind] * interaction.count * decay(interaction.at, now);
    const row = sums.get(interaction.userId) ?? new Map<string, number>();
    row.set(interaction.recipeId, (row.get(interaction.recipeId) ?? 0) + weight);
    sums.set(interaction.userId, row);
  }
  const ratings: RatingMatrix = new Map();
  for (const [userId, row] of sums) ratings.set(userId, new Map([...row].map(([recipeId, sum]) => [recipeId, Math.log1p(sum)])));
  return ratings;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** k hàng xóm gần nhất của mỗi món (chỉ độ tương đồng dương), cao xuống thấp, hòa thì theo id. */
export function itemNeighbors(ratings: RatingMatrix, lambda = SHRINKAGE_LAMBDA, k = NEIGHBORS_K) {
  const squares = new Map<string, number>();
  const dots = new Map<string, { a: string; b: string; dot: number; support: number }>();
  for (const row of ratings.values()) {
    const items = [...row];
    for (const [recipeId, value] of items) squares.set(recipeId, (squares.get(recipeId) ?? 0) + value * value);
    for (let x = 0; x < items.length; x++) {
      for (let y = x + 1; y < items.length; y++) {
        const [a, va] = items[x];
        const [b, vb] = items[y];
        const key = pairKey(a, b);
        const entry = dots.get(key) ?? { a, b, dot: 0, support: 0 };
        entry.dot += va * vb;
        entry.support += 1;
        dots.set(key, entry);
      }
    }
  }
  const lists = new Map<string, Neighbor[]>();
  for (const { a, b, dot, support } of dots.values()) {
    const similarity = (dot / Math.sqrt(squares.get(a)! * squares.get(b)!)) * (support / (support + lambda));
    if (!(similarity > 0)) continue;
    if (!lists.has(a)) lists.set(a, []);
    if (!lists.has(b)) lists.set(b, []);
    lists.get(a)!.push({ recipeId: b, similarity, support });
    lists.get(b)!.push({ recipeId: a, similarity, support });
  }
  for (const [recipeId, list] of lists) {
    lists.set(recipeId, list.sort((x, y) => y.similarity - x.similarity || x.recipeId.localeCompare(y.recipeId)).slice(0, k));
  }
  return lists;
}

export function buildCollaborativeModel(interactions: Interaction[], now = new Date(), lambda = SHRINKAGE_LAMBDA, k = NEIGHBORS_K): CollaborativeModel {
  const ratings = buildRatings(interactions, now);
  return { ratings, neighbors: itemNeighbors(ratings, lambda, k) };
}

/** n_u: số món khác nhau người này đã tương tác (cho khởi đầu lạnh của bộ trộn). */
export const interactedCount = (model: CollaborativeModel, userId: string) => model.ratings.get(userId)?.size ?? 0;

export type CollaborativeScore = {
  recipeId: string;
  score: number;
  /** Món đã tương tác đóng góp nhiều nhất (lý do "Người hay nấu … cũng nấu món này"); null nếu điểm 0. */
  because: string | null;
};

/** s2 cho từng món ứng viên mà người dùng chưa tương tác (món đã tương tác không được dự đoán, bỏ khỏi kết quả). */
export function collaborativeScores(model: CollaborativeModel, userId: string, candidateIds: string[]): CollaborativeScore[] {
  const row = model.ratings.get(userId) ?? new Map<string, number>();
  return candidateIds
    .filter((recipeId) => !row.has(recipeId))
    .map((recipeId) => {
      let score = 0;
      let because: string | null = null;
      let best = 0;
      for (const neighbor of model.neighbors.get(recipeId) ?? []) {
        const rating = row.get(neighbor.recipeId);
        if (!rating) continue;
        const part = neighbor.similarity * rating;
        score += part;
        if (part > best) { best = part; because = neighbor.recipeId; }
      }
      return { recipeId, score, because };
    })
    .sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId));
}

/**
 * "Người khác cũng nấu": hàng xóm của món đang xem có ≥ MIN_SUPPORT người KHÁC người đang xem cùng tương tác với cả hai món.
 * Chỉ trả id món và độ tương đồng.
 */
export function alsoCooked(model: CollaborativeModel, recipeId: string, viewerId: string | null, limit = 6, candidateIds?: Set<string>) {
  const viewer = viewerId ? model.ratings.get(viewerId) : undefined;
  return (model.neighbors.get(recipeId) ?? [])
    .filter((neighbor) => !candidateIds || candidateIds.has(neighbor.recipeId))
    .filter((neighbor) => neighbor.support - (viewer?.has(recipeId) && viewer.has(neighbor.recipeId) ? 1 : 0) >= MIN_SUPPORT)
    .slice(0, limit)
    .map((neighbor) => ({ recipeId: neighbor.recipeId, similarity: neighbor.similarity }));
}
