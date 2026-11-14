# Giải thích code bộ gợi ý món (để mở code trình bày)

> **Commit dùng để ghi số dòng: `3496c1b`** (Merge branch 'sua-mon-khong-thich', nhánh `main`). Số dòng chỉ đúng với commit này;
> sửa code sau đó thì tìm bằng cột "Ctrl+F". Thư mục: `backend/src/modules/recommendation/`. Công thức đầy đủ và số liệu đánh giá:
> `docs/thuat-toan-goi-y.md`.

Thứ tự trình bày: 1) luồng chung `runRecommendation` → 2) lọc an toàn → 3) thuật toán 1 (nội dung) → 4) thuật toán 2 (cộng tác)
→ 5) thuật toán 3 (tri thức) → 6) bộ trộn và lý do. Các "ví dụ minh họa" là số tự đặt để dễ hiểu, không phải dữ liệu thật.

---

## 1. Luồng chung — `runRecommendation` (hybrid.ts)

### 1.1. Lọc an toàn trước, rồi lọc theo ngữ cảnh — `hybrid.ts:160–167`

Ctrl+F: `export function runRecommendation`

```ts
export function runRecommendation(data: EngineData, query: EngineQuery): { coldStart: boolean; items: RecommendationItem[] } {
  const space = getFeatureSpace(data.recipes);
  const byId = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const coldStart = interactedCount(data.model, data.userId) < COLD_START_KAPPA;
  let candidates = safeRecipes(data.recipes, data.profile, { mealType: query.mealType }).filter((recipe) => recipe.id !== query.recipeId);
  if (query.focusItem) candidates = candidates.filter((recipe) => usesPantryItem(recipe, query.focusItem!));
  const pantryIndex = groupPantryByName(data.pantry);
  if (query.context === "pantry") candidates = candidates.filter((recipe) => pantryFeature(recipe, data.pantry, data.now, pantryIndex).inPantry > 0);
```

**Code làm gì:** `space` là không gian vector đặc trưng của cả bộ món (thuật toán 1 dùng). Dòng 164 gọi `safeRecipes` để bỏ món
vi phạm dị ứng, món không thích, chế độ chay, món ẩn và sai bữa — **trước khi chạy bất kỳ thuật toán nào**. Sau đó lọc thêm theo
ngữ cảnh: "gợi ý cho thực phẩm X" (`focusItem`) chỉ giữ món dùng X; ngữ cảnh Kho chỉ giữ món có ít nhất một nguyên liệu trong kho.
`coldStart` = người dùng tương tác với ít hơn `COLD_START_KAPPA = 10` món.

**Nói với cô:** "Mọi gợi ý đi qua bộ lọc an toàn trước, nên thuật toán có chấm điểm cao đến đâu cũng không thể đưa ra món vi phạm
dị ứng."

### 1.2. Hai ngữ cảnh chỉ dùng một thuật toán — `hybrid.ts:173–180`

Ctrl+F: `query.context === "similar"`

```ts
  if (query.context === "similar" || query.context === "also-cooked") {
    const base = query.recipeId ? byId.get(query.recipeId) : undefined;
    if (!base) return { coldStart, items: [] };
    if (query.context === "similar") {
      return {
        coldStart,
        items: similarRecipes(space, base.id, ids, query.limit)
          .map((entry) => item(entry.recipeId, entry.score, similarReason(entry, base.cuisine), { ...zeroComponents(), content: entry.score })),
```

**Code làm gì:** ở trang chi tiết món, "Món tương tự" chỉ dùng thuật toán 1 (cosine giữa hai vector món), "Người khác cũng nấu"
(dòng 183–187) chỉ dùng thuật toán 2 (`alsoCooked`). Cả hai vẫn chỉ chọn trong `ids` — tập đã qua lọc an toàn.

**Nói với cô:** "Ở chi tiết món, hai khối gợi ý mỗi khối dùng một thuật toán riêng, nhưng vẫn lấy từ danh sách đã lọc an toàn."

### 1.3. Chạy ba thuật toán trên cùng tập ứng viên — `hybrid.ts:190–197`

Ctrl+F: `const user = userVector`

```ts
  const user = userVector(data.profile, data.interactions, space, data.now);
  const content = new Map(contentScores(user, ids, space).map((entry) => [entry.recipeId, entry]));
  const collaborative = new Map(collaborativeScores(data.model, data.userId, ids).map((entry) => [entry.recipeId, entry]));
  const windowStart = recentWindowStart(data.now);
  const recentRecipeIds = [...new Set(data.interactions
    .filter((entry) => (entry.kind === "EATEN" || entry.kind === "PLANNED") && entry.at >= windowStart && entry.at <= data.now)
    .map((entry) => entry.recipeId))];
  const target = mealTarget(data.profile, query.mealType, data.today);
```

**Code làm gì:** dựng vector sở thích người dùng rồi chấm điểm thuật toán 1 (`content`), thuật toán 2 (`collaborative`), và
chuẩn bị dữ liệu cho thuật toán 3: các món đã ăn/xếp trong 3 ngày qua (`recentRecipeIds`, để đo đa dạng) và calo/đạm mục tiêu của
bữa này (`target`). Dòng 198–200 chấm thuật toán 3 (`knowledgeScore`) cho từng ứng viên.

**Nói với cô:** "Ba thuật toán chấm điểm độc lập trên cùng một tập món an toàn, sau đó mới trộn."

### 1.4. Trọng số, trộn điểm, đa dạng hóa — `hybrid.ts:201–209`

Ctrl+F: `const weights = withPopularity`

```ts
  const interacted = interactedCount(data.model, data.userId);
  const weights = withPopularity(coldStartWeights(query.weights ?? CONTEXT_WEIGHTS[query.context], interacted), interacted, query.popularityWeight);
  const raw = {
    content: new Map([...content].map(([id, entry]) => [id, entry.score])),
    collaborative: new Map([...collaborative].map(([id, entry]) => [id, entry.score])),
    knowledge: new Map([...knowledge].map(([id, entry]) => [id, entry.score])),
    popularity: data.model.popularity,
  };
  const picked = mmr(blendScores(ids, raw, weights), space, query.limit);
```

**Code làm gì:** lấy trọng số theo ngữ cảnh (`CONTEXT_WEIGHTS`), chỉnh theo số món người dùng đã tương tác (`coldStartWeights`:
người mới thì giảm thuật toán 2; `withPopularity`: thêm thành phần phổ biến cho người mới). `blendScores` chuẩn hóa từng điểm về
[0, 1] rồi cộng có trọng số; `mmr` chọn lần lượt để danh sách không toàn món giống nhau. Chi tiết ở mục 6.

**Nói với cô:** "Điểm cuối cùng là tổng có trọng số của ba thuật toán; người mới chưa có lịch sử thì dựa nhiều hơn vào hồ sơ và độ
phổ biến."

### 1.5. Gắn lý do cho từng món — `hybrid.ts:210–217`

Ctrl+F: `const usedKinds = new Set`

```ts
  const usedKinds = new Set<string>();
  return {
    coldStart,
    items: picked.map((entry) => {
      const candidatesForReason = reasonCandidates({
        content: content.get(entry.recipeId),
        collaborative: collaborative.get(entry.recipeId),
        knowledge: knowledge.get(entry.recipeId),
```

**Code làm gì:** với mỗi món đã chọn, `reasonCandidates` liệt kê mọi lý do viết được kèm mức đóng góp, `pickReason` chọn một lý
do; `usedKinds` nhớ loại lý do đã dùng để các món trong cùng danh sách không cùng một câu.

**Nói với cô:** "Lý do lấy từ phần đóng góp điểm nhiều nhất, nên lý do hiển thị đúng là lý do món được chọn."

---

## 2. Lọc an toàn (safety.ts)

### 2.1. Đúng bữa — `safety.ts:20–21`

Ctrl+F: `export const fitsMealType`

```ts
export const fitsMealType = (recipe: Pick<SafetyRecipe, "mealTypes">, mealType?: MealType) =>
  !mealType || !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType);
```

**Code làm gì:** ngữ cảnh không hỏi bữa nào, hoặc món chưa khai báo bữa (`mealTypes` rỗng) thì dùng được; còn lại món phải có
đúng bữa đang gợi ý (vd. bữa sáng).

**Nói với cô:** "Gợi ý cho bữa sáng thì chỉ lấy món được gắn bữa sáng."

### 2.2. Độ phù hợp với hồ sơ — `safety.ts:24–30`

Ctrl+F: `export function recipeFit`

```ts
export function recipeFit(recipe: SafetyRecipe, profile: SafetyProfile) {
  const warnings = recipeWarnings(recipe, profile);
  return {
    ...warnings,
    safe: !warnings.allergens.length && !warnings.dislikedFoods.length && !warnings.dietConflict,
  };
}
```

**Code làm gì:** `recipeWarnings` trả ba danh sách vi phạm: thành phần dị ứng, nguyên liệu không thích, xung đột chay/thuần chay.
Món chỉ `safe` khi cả ba đều rỗng. Cùng kết quả này được dùng để gắn nhãn "Chứa: …" trên thẻ món.

**Nói với cô:** "Một món an toàn khi không có thành phần dị ứng, không có thứ người dùng không thích và đúng chế độ ăn."

### 2.3. Các vi phạm tính ở đâu — `recipe-fit.service.ts:83–88` (file `backend/src/services/recipe-fit.service.ts`)

Ctrl+F: `export function recipeWarnings`

```ts
    allergens: findRestrictedTerms(recipe, expandRestrictedTerms(profile?.allergies ?? [])).length
      ? allergenLabels(recipe, profile?.allergies ?? [])
      : [],
    // Món không thích (khẩu vị): tên nguyên liệu chính bị tránh, không tính gia vị/thành phần ẩn.
    dislikedFoods: restrictedFoodNames(recipe, expandRestrictedTerms(profile?.dislikedFoods ?? [], { strict: false })),
    dietConflict: matchesRequiredDiet(recipe, dietType) ? null : dietType,
```

**Code làm gì:** `expandRestrictedTerms` biến mục người dùng nhập thành các cụm cần tránh: dị ứng mở rộng theo nhóm (gõ "trứng gà"
→ cả nhóm Trứng, kể cả thành phần ẩn như mayonnaise); món không thích (`strict: false`) chỉ lấy nguyên liệu chính. Danh mục nhóm ở
`backend/src/services/allergy-groups.ts`.

**Nói với cô:** "Dị ứng lọc rộng theo nhóm vì là chuyện an toàn; món không thích chỉ lọc đúng nguyên liệu vì là khẩu vị."

### 2.4. Lọc cứng và hàm dùng chung — `safety.ts:33–40`

Ctrl+F: `export function isRecipeSafe`

```ts
export function isRecipeSafe(recipe: SafetyRecipe, profile: SafetyProfile, context: SafetyContext = {}) {
  if (recipe.hiddenAt !== undefined && isRecipeHidden({ hiddenAt: recipe.hiddenAt, deletedAt: (recipe as { deletedAt?: Date | null }).deletedAt })) return false;
  return fitsMealType(recipe, context.mealType) && recipeFit(recipe, profile).safe;
}

export function safeRecipes<T extends SafetyRecipe>(recipes: T[], profile: SafetyProfile, context: SafetyContext = {}) {
  return recipes.filter((recipe) => isRecipeSafe(recipe, profile, context));
}
```

**Code làm gì:** món bị Admin ẩn hoặc xóa → loại ngay; còn lại phải đúng bữa và `safe`. `safeRecipes` là hàm duy nhất mà
`runRecommendation` (hybrid.ts:164), thực đơn và các nguồn gợi ý khác gọi.

**Nói với cô:** "Chỉ có một hàm lọc dùng chung cho mọi nơi, nên không có chỗ nào quên lọc."

**Test:** `backend/src/test/dietary-matrix.test.ts` — "Dietary safety matrix: 105 profiles × every suggestion source", tiêu biểu:
`"%s never returns a recipe that violates the profile or is hidden"` (dòng 141) và `"safety keeps exactly the recipes the oracle
allows (no over-filtering), per meal type"` (dòng 150). Đáp án viết tay theo tên nguyên liệu, không gọi lại code lọc.
Lệnh (trong `backend/`): `npx vitest run src/test/dietary-matrix.test.ts`

---

## 3. Thuật toán 1 — lọc theo nội dung (features.ts, interactions.ts, content-based.ts)

### 3.1. Năm khối đặc trưng và trọng số — `features.ts:11`

Ctrl+F: `export const BLOCK_WEIGHTS`

```ts
export const BLOCK_WEIGHTS = { ingredients: 0.45, cuisine: 0.15, meal: 0.1, diet: 0.1, nutrition: 0.2 } as const;
```

**Code làm gì:** mỗi món được mô tả bằng 5 khối: nguyên liệu (nặng nhất, 0,45), ẩm thực 0,15, bữa 0,1, nhãn chế độ ăn 0,1,
dinh dưỡng 0,2. Tổng bằng 1.

**Nói với cô:** "Hai món giống nhau chủ yếu vì dùng chung nguyên liệu, sau đó mới đến dinh dưỡng và ẩm thực."

### 3.2. TF-IDF nguyên liệu — `features.ts:61–68`

Ctrl+F: `export const idfOf`

```ts
export const idfOf = (size: number, documentFrequency: number) => Math.log((1 + size) / (1 + documentFrequency)) + 1;

/** tf của từng nguyên liệu trong một món: 1, nguyên liệu tùy chọn 0,5 (trùng tên thì lấy giá trị lớn hơn). */
function termFrequencies(recipe: Pick<FeatureRecipe, "ingredients">) {
  const tf = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    const key = normalizeFoodText(ingredient.name);
    tf.set(key, Math.max(tf.get(key) ?? 0, ingredient.optional ? 0.5 : 1));
```

**Code làm gì:** `size` = N số món, `documentFrequency` = df số món có nguyên liệu đó. Nguyên liệu phổ biến (muối, dầu ăn) có idf
thấp nên ít ảnh hưởng; nguyên liệu đặc trưng (cá lóc) có idf cao. tf = 1, nguyên liệu tùy chọn 0,5.

**Ví dụ minh họa:** N = 33. "Dầu ăn" có trong 25 món: idf = ln(34/26) + 1 ≈ 1,27. "Cá lóc" có trong 1 món: idf = ln(34/2) + 1 ≈ 3,83.

**Nói với cô:** "Nguyên liệu càng hiếm thì càng nói lên đặc trưng của món, nên được trọng số cao hơn."

### 3.3. Khối dinh dưỡng chuẩn hóa — `features.ts:85–92`

Ctrl+F: `export function nutritionBlock`

```ts
export function nutritionBlock(values: Record<Nutrient, number>, stats: NutritionStats): SparseVector {
  const block: SparseVector = new Map();
  for (const nutrient of NUTRIENTS) {
    const { mean, std } = stats[nutrient];
    const z = std ? Math.max(-3, Math.min(3, (values[nutrient] - mean) / std)) / 3 : 0;
    if (z) block.set(nutrient, z);
  }
  return normalizeL2(block);
```

**Code làm gì:** với calo, đạm, tinh bột, béo: z-score so với trung bình của cả bộ món, cắt trong [−3, 3] rồi chia 3 để về
[−1, 1]; cuối cùng chuẩn hóa độ dài L2 = 1 để so được bằng cosine.

**Ví dụ minh họa:** trung bình 500 kcal, độ lệch 100 → món 650 kcal có z = 1,5, chia 3 = 0,5.

**Nói với cô:** "Dinh dưỡng được đưa về cùng thang đo, để món nhiều calo hay nhiều đạm so sánh được với nhau."

### 3.4. Độ tương đồng giữa hai vector — `features.ts:141–148`

Ctrl+F: `export function similarity`

```ts
export function similarity(a: FeatureVector, b: FeatureVector, weights: Record<Block, number> = BLOCK_WEIGHTS): Similarity {
  const blocks = {} as Record<Block, number>;
  let score = 0;
  for (const block of BLOCKS) {
    blocks[block] = weights[block] * dot(a[block], b[block]);
    score += blocks[block];
  }
  return { score, blocks };
```

**Code làm gì:** mỗi khối đã có độ dài 1 nên tích vô hướng `dot` chính là cosine của khối đó; nhân trọng số rồi cộng lại. Giữ
riêng phần đóng góp của từng khối (`blocks`) để viết lý do ("Có nguyên liệu bạn hay dùng…").

**Nói với cô:** "Độ giống nhau là tổng cosine có trọng số của 5 khối, và biết được khối nào đóng góp nhiều nhất."

### 3.5. Tương tác có suy giảm theo thời gian — `interactions.ts:13–15` và `content-based.ts:49–50`

Ctrl+F: `export const CONTENT_WEIGHTS` / `export const interactionWeight`

```ts
export const CONTENT_WEIGHTS: Record<InteractionKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2, PLANNED: 0.5 };
export const COLLABORATIVE_WEIGHTS: Record<CollaborativeKind, number> = { EATEN: 3, POSTED: 3, LIKED: 2 };
export const DECAY_TAU_DAYS = 30;
```

```ts
export const interactionWeight = (interaction: Interaction, now: Date) =>
  CONTENT_WEIGHTS[interaction.kind] * interaction.count * decay(interaction.at, now);
```

**Code làm gì:** mỗi lần ăn/đăng bài nặng 3, thích bài 2, chỉ có trong thực đơn 0,5; nhân số lần và hệ số suy giảm
`decay = e^(−Δ/τ)` với Δ = số ngày đã qua, τ = 30 ngày (`interactions.ts:19–21`).

**Ví dụ minh họa:** ăn món hôm nay: 3 × e⁰ = 3; ăn cách đây 30 ngày: 3 × e⁻¹ ≈ 1,10; cách đây 60 ngày: 3 × e⁻² ≈ 0,41.

**Nói với cô:** "Món ăn gần đây phản ánh khẩu vị hiện tại hơn món ăn từ lâu, nên được tính nặng hơn."

### 3.6. Vector sở thích người dùng — `content-based.ts:62–68`

Ctrl+F: `add(profilePrior(profile, space), PRIOR_WEIGHT)`

```ts
  add(profilePrior(profile, space), PRIOR_WEIGHT);
  for (const interaction of history) {
    const vector = space.vectors.get(interaction.recipeId);
    if (vector) add(vector, interactionWeight(interaction, now));
  }
  const user = emptyVector();
  for (const block of BLOCKS) user[block] = normalizeL2(sum[block]);
```

**Code làm gì:** u = β·p_u + Σ ω·e^(−Δ/τ)·v_món. `profilePrior` (dòng 31–46) là vector từ hồ sơ: ẩm thực ưa thích, chế độ ăn, dinh
dưỡng mục tiêu một bữa; `PRIOR_WEIGHT` β = 1. Cộng thêm vector các món đã ăn/thích theo trọng số ở 3.5, rồi chuẩn hóa từng khối.
Người mới chưa có lịch sử thì u = vector hồ sơ (vẫn gợi ý được).

**Nói với cô:** "Sở thích người dùng là trung bình có trọng số của các món họ đã ăn, cộng với thông tin từ hồ sơ."

### 3.7. Điểm thuật toán 1 cho từng món — `content-based.ts:99–104`

Ctrl+F: `export function contentScores`

```ts
export function contentScores(user: FeatureVector, candidateIds: string[], space: FeatureSpace) {
  return candidateIds
    .map((id) => scoreAgainst(user, id, space))
    .filter((entry): entry is ContentScore => entry !== null)
    .sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId));
}
```

**Code làm gì:** s1 = độ tương đồng (3.4) giữa vector người dùng và vector từng món ứng viên, xếp cao xuống thấp; `scoreAgainst`
(dòng 91–96) giữ thêm 3 nguyên liệu đóng góp nhiều nhất để viết lý do.

**Nói với cô:** "Món nào càng giống khẩu vị người dùng thì điểm thuật toán 1 càng cao."

**Test:** `backend/src/modules/recommendation/content-based.test.ts`, tiêu biểu: `"computes IDF by hand: idf = ln((1+N)/(1+df)) + 1,
names matched loosely"` (dòng 26), `"weights interactions by kind and decays them with τ = 30 days"` (dòng 107),
`"uses only the profile prior for a user without history (cold start)"` (dòng 131).
Lệnh: `npx vitest run src/modules/recommendation/content-based.test.ts`

---

## 4. Thuật toán 2 — lọc cộng tác theo món (collaborative.ts)

### 4.1. Ma trận điểm ngầm r_ui — `collaborative.ts:24–31`

Ctrl+F: `export function buildRatings`

```ts
    if (!(interaction.kind in COLLABORATIVE_WEIGHTS)) continue;
    const weight = COLLABORATIVE_WEIGHTS[interaction.kind as CollaborativeKind] * interaction.count * decay(interaction.at, now);
    const row = sums.get(interaction.userId) ?? new Map<string, number>();
    row.set(interaction.recipeId, (row.get(interaction.recipeId) ?? 0) + weight);
    sums.set(interaction.userId, row);
  }
  const ratings: RatingMatrix = new Map();
  for (const [userId, row] of sums) ratings.set(userId, new Map([...row].map(([recipeId, sum]) => [recipeId, Math.log1p(sum)])));
```

**Code làm gì:** r_ui = ln(1 + Σ ω·số lần·e^(−Δ/30)). Không có điểm sao, nên dùng phản hồi ngầm (ăn 3, đăng bài 3, thích 2). "Có
trong thực đơn" (PLANNED) bị bỏ (dòng 24) để tránh vòng lặp: món được gợi ý → vào thực đơn → lại được gợi ý nhiều hơn
(`interactions.ts:5–6`). `log1p` làm người ăn một món 20 lần không lấn át hoàn toàn.

**Ví dụ minh họa:** ăn món hôm nay 2 lần: Σ = 3 × 2 × 1 = 6 → r = ln 7 ≈ 1,95.

**Nói với cô:** "Không có đánh giá sao, nên hệ thống coi việc ăn, đăng bài, thích bài là tín hiệu người dùng thích món."

### 4.2. Độ tương đồng món–món có co rút — `collaborative.ts:58–59`

Ctrl+F: `support / (support + lambda)`

```ts
    const similarity = (dot / Math.sqrt(squares.get(a)! * squares.get(b)!)) * (support / (support + lambda));
    if (!(similarity > 0)) continue;
```

**Code làm gì:** cosine giữa hai cột món (hai món được cùng những người thích), nhân hệ số co rút n/(n + λ), với n (`support`) = số
người tương tác với cả hai món, λ = `SHRINKAGE_LAMBDA = 5` (dòng 11). Cặp món chỉ 1–2 người cùng ăn bị giảm độ tin cậy.

**Ví dụ minh họa:** cosine 0,9 nhưng chỉ 1 người cùng ăn: 0,9 × 1/6 = 0,15; 20 người: 0,9 × 20/25 = 0,72.

**Nói với cô:** "Hai món được nhiều người cùng ăn mới coi là giống nhau; trùng hợp của một hai người thì bị giảm trọng số."

### 4.3. Giữ k hàng xóm gần nhất — `collaborative.ts:65–66`

Ctrl+F: `.slice(0, k)`

```ts
  for (const [recipeId, list] of lists) {
    lists.set(recipeId, list.sort((x, y) => y.similarity - x.similarity || x.recipeId.localeCompare(y.recipeId)).slice(0, k));
```

**Code làm gì:** mỗi món chỉ giữ k = `NEIGHBORS_K = 20` món giống nhất (dòng 12), xếp theo độ tương đồng, hòa thì theo id cho kết
quả ổn định.

**Nói với cô:** "Mỗi món chỉ nhớ 20 món giống nó nhất, để dự đoán nhanh và bớt nhiễu."

### 4.4. Dự đoán điểm cho món chưa ăn — `collaborative.ts:97–104`

Ctrl+F: `export function collaborativeScores`

```ts
      for (const neighbor of model.neighbors.get(recipeId) ?? []) {
        const rating = row.get(neighbor.recipeId);
        if (!rating) continue;
        const part = neighbor.similarity * rating;
        score += part;
        if (part > best) { best = part; because = neighbor.recipeId; }
      }
      return { recipeId, score, because };
```

**Code làm gì:** s2(u, j) = Σ sim(i, j)·r_ui trên các món i người dùng đã ăn và nằm trong 20 hàng xóm của j (Deshpande–Karypis).
Món đã tương tác thì không dự đoán (dòng 92). `because` là món đóng góp nhiều nhất, dùng cho lý do "Người hay nấu … cũng nấu món này".

**Ví dụ minh họa:** đã ăn Phở (r = 1,95) và Bún bò (r = 1,1); Bún chả giống Phở 0,6, giống Bún bò 0,4 → s2 = 0,6 × 1,95 + 0,4 × 1,1
= 1,61; lý do nêu Phở.

**Nói với cô:** "Món được gợi ý vì người ăn những món bạn đã ăn cũng hay ăn món đó."

### 4.5. "Người khác cũng nấu" và quyền riêng tư — `collaborative.ts:117–119`

Ctrl+F: `MIN_SUPPORT`

```ts
    .filter((neighbor) => neighbor.support - (viewer?.has(recipeId) && viewer.has(neighbor.recipeId) ? 1 : 0) >= MIN_SUPPORT)
    .slice(0, limit)
    .map((neighbor) => ({ recipeId: neighbor.recipeId, similarity: neighbor.similarity }));
```

**Code làm gì:** chỉ hiện cặp món có ít nhất `MIN_SUPPORT = 3` người **khác** người đang xem cùng tương tác (trừ chính người xem ra
khỏi số đếm). Kết quả chỉ có id món và độ tương đồng, không có tên hay số người.

**Nói với cô:** "Khối này chỉ dựa trên số liệu tổng hợp của ít nhất 3 người khác, nên không lộ ai đã ăn gì."

**Test:** `backend/src/modules/recommendation/collaborative.test.ts`, tiêu biểu: `"is cosine × n/(n+λ), computed by hand"`
(dòng 33), `"scores unseen recipes Σ sim·r over the user's neighbours, with the top contributor as reason"` (dòng 60),
`"does not count the viewer: 3 users including the viewer is not enough"` (dòng 86).
Lệnh: `npx vitest run src/modules/recommendation/collaborative.test.ts`

---

## 5. Thuật toán 3 — dựa trên tri thức, đa tiêu chí (knowledge-based.ts)

### 5.1. Năm tiêu chí và trọng số — `knowledge-based.ts:19`

Ctrl+F: `export const KNOWLEDGE_WEIGHTS`

```ts
export const KNOWLEDGE_WEIGHTS = { expiring: 0.35, pantry: 0.25, nutrition: 0.2, diversity: 0.1, preference: 0.1 } as const;
```

**Code làm gì:** s3 = 0,35·f_hạn + 0,25·f_kho + 0,20·f_dd + 0,10·f_dạng + 0,10·f_ưu; mỗi f nằm trong [0, 1]. Đồ sắp hết hạn nặng
nhất vì mục tiêu đề tài là giảm lãng phí.

**Nói với cô:** "Thuật toán 3 chấm theo các quy tắc nghiệp vụ, ưu tiên nhất là dùng đồ sắp hết hạn trong kho."

### 5.2. f_hạn — dùng đồ sắp hết hạn — `knowledge-based.ts:61–67`

Ctrl+F: `export function expiringFeature`

```ts
      if (!item.expiryDate || pantryExpiryState(item.expiryDate, now) !== "expiring") continue;
      const days = daysLeft(item.expiryDate, now);
      used.set(item.name, Math.min(used.get(item.name) ?? Infinity, days));
    }
  }
  const window = PANTRY_EXPIRING_WINDOW_DAYS + 1;
  const sum = [...used.values()].reduce((total, days) => total + (window - days) / window, 0);
```

**Code làm gì:** với mỗi thực phẩm trong kho còn hạn ≤ D = 3 ngày (`PANTRY_EXPIRING_WINDOW_DAYS`) mà món dùng, cộng (D + 1 − d)/(D + 1),
d = số ngày còn lại; càng gần hạn càng được nhiều điểm. Kết quả cắt tối đa 1 (dòng 68).

**Ví dụ minh họa:** đậu hũ còn 1 ngày: (4 − 1)/4 = 0,75; ức gà còn 3 ngày: 1/4 = 0,25 → món dùng cả hai: f_hạn = min(1; 1,0) = 1.

**Nói với cô:** "Món dùng thực phẩm sắp hỏng được đẩy lên trước để người dùng nấu kịp."

### 5.3. f_kho — tỷ lệ nguyên liệu có sẵn — `knowledge-based.ts:75–77`

Ctrl+F: `export function pantryFeature`

```ts
  const required = recipe.ingredients.filter((ingredient) => !ingredient.optional);
  const inPantry = required.length ? matchRecipeToPantry({ ingredients: required }, pantry, now, byName).inPantry.length : 0;
  return { value: required.length ? inPantry / required.length : 0, inPantry, required: required.length };
```

**Code làm gì:** chỉ tính nguyên liệu bắt buộc (bỏ tùy chọn), đếm số có trong kho còn hạn bằng cùng hàm so khớp với khối "Dành cho
bạn" và trừ kho; f_kho = có / tổng.

**Ví dụ minh họa:** món cần 6 nguyên liệu bắt buộc, kho có 4 → f_kho = 0,67 (lý do "Có sẵn 4/6 nguyên liệu trong kho").

**Nói với cô:** "Món càng có sẵn nhiều nguyên liệu thì càng ít phải đi chợ."

### 5.4. f_dd — hợp mục tiêu dinh dưỡng của bữa — `knowledge-based.ts:81–87`

Ctrl+F: `export function nutritionFeature`

```ts
export function nutritionFeature(recipe: Pick<KnowledgeRecipe, "calories" | "proteinG">, target: MealTarget) {
  const calories = target.calories > 0
    ? Math.exp(-0.5 * ((recipe.calories - target.calories) / (CALORIE_SIGMA * target.calories)) ** 2)
    : 0;
  const protein = target.proteinG > 0 ? Math.min(1, recipe.proteinG / target.proteinG) : 1;
  return 0.6 * calories + 0.4 * protein;
}
```

**Code làm gì:** phần calo là hàm chuông Gauss quanh calo mục tiêu E* của bữa, độ rộng σ = `CALORIE_SIGMA` = 35% mục tiêu; phần đạm
= đạm món / đạm mục tiêu P* (tối đa 1). Trộn 0,6 calo + 0,4 đạm. E*, P* tính ở `mealTarget` (dòng 148–163): hôm nay đã ăn thì chia
phần còn lại cho số bữa còn lại, chưa ăn thì theo tỷ lệ bữa (sáng 25%, trưa 35%, tối 30%, phụ 10%).

**Ví dụ minh họa:** mục tiêu 600 kcal, 25 g đạm; món 810 kcal (lệch đúng 35%), 20 g đạm: calo = e^(−0,5) ≈ 0,61, đạm = 0,8 →
f_dd = 0,6 × 0,61 + 0,4 × 0,8 ≈ 0,68.

**Nói với cô:** "Món có calo càng gần mục tiêu của bữa và đủ đạm thì điểm dinh dưỡng càng cao."

### 5.5. f_dạng — khác món mấy ngày gần đây — `knowledge-based.ts:93–99`

Ctrl+F: `export function diversityFeature`

```ts
  let max = 0;
  for (const recentId of recentRecipeIds) {
    if (recentId === recipeId) return 0;
    const other = space.vectors.get(recentId);
    if (other) max = Math.max(max, similarity(vector, other).score);
  }
  return Math.max(0, Math.min(1, 1 - max));
```

**Code làm gì:** f_dạng = 1 − độ giống lớn nhất với các món đã ăn/xếp trong `RECENT_DAYS = 3` ngày qua (dùng lại vector của thuật
toán 1). Món vừa ăn → 0; chưa ăn gì gần đây → 1.

**Ví dụ minh họa:** món giống nhất với món đã ăn hôm qua ở mức 0,7 → f_dạng = 0,3.

**Nói với cô:** "Tránh gợi ý lại món giống món vừa ăn để bữa ăn đa dạng."

### 5.6. Cộng có trọng số — `knowledge-based.ts:121–128`

Ctrl+F: `export function knowledgeScore`

```ts
    preference: context.dietType && prefersDiet(recipe, context.dietType) ? 1 : 0,
  };
  const parts = {} as Record<KnowledgePart, number>;
  let score = 0;
  for (const part of KNOWLEDGE_PARTS) {
    parts[part] = KNOWLEDGE_WEIGHTS[part] * features[part];
    score += parts[part];
  }
```

**Code làm gì:** f_ưu = 1 nếu món mang nhãn Ít tinh bột/Giàu đạm đúng chế độ trong hồ sơ. Mỗi tiêu chí nhân trọng số 5.1 rồi cộng;
`parts` giữ phần đóng góp từng tiêu chí để viết lý do ("Dùng 2 thực phẩm sắp hết hạn: …").

**Nói với cô:** "Điểm thuật toán 3 là tổng năm tiêu chí, và giữ lại từng phần để giải thích vì sao món được gợi ý."

**Test:** `backend/src/modules/recommendation/hybrid.test.ts`, khối "Algorithm 3 features", tiêu biểu:
`"f_exp: Σ (D+1−d)/(D+1) over pantry items expiring within 3 days that the recipe uses, capped at 1"` (dòng 28),
`"f_dd: Gaussian on calories (σ = 35% of target) plus protein share"` (dòng 44),
`"weights the parts with α = 0.35/0.25/0.20/0.10/0.10 and adds the diet preference"` (dòng 60).
Lệnh: `npx vitest run src/modules/recommendation/hybrid.test.ts -t "Algorithm 3"`

---

## 6. Bộ trộn và lý do (hybrid.ts, reasons.ts)

### 6.1. Trọng số theo ngữ cảnh — `hybrid.ts:23–30`

Ctrl+F: `export const CONTEXT_WEIGHTS`

```ts
export const CONTEXT_WEIGHTS: Record<RecommendationContext, Record<Algorithm, number>> = {
  today: { content: 0.35, collaborative: 0.25, knowledge: 0.4 },
  // Chốt sau đánh giá R6 (docs/thuat-toan-goi-y.md, bảng 3): 0,60/0,20/0,20 hơn bộ ban đầu 0,45/0,30/0,25 trên tập kiểm định.
  "for-you": { content: 0.6, collaborative: 0.2, knowledge: 0.2 },
  pantry: { content: 0.15, collaborative: 0.1, knowledge: 0.75 },
  similar: { content: 1, collaborative: 0, knowledge: 0 },
  "also-cooked": { content: 0, collaborative: 1, knowledge: 0 },
};
```

**Code làm gì:** mỗi ngữ cảnh một bộ trọng số (nội dung / cộng tác / tri thức). "Hôm nay" ưu tiên tri thức (kho, dinh dưỡng); "Dành
cho bạn" ưu tiên khẩu vị, bộ 0,60/0,20/0,20 chọn bằng đánh giá mô phỏng; "Kho" gần như chỉ tri thức (0,75).

**Nói với cô:** "Cùng ba thuật toán nhưng mỗi màn hình trộn theo tỷ lệ khác, phù hợp mục đích của màn hình đó; tỷ lệ ở 'Dành cho
bạn' được chọn bằng thực nghiệm."

### 6.2. Chuẩn hóa min–max — `hybrid.ts:42–47`

Ctrl+F: `export function minMax`

```ts
export function minMax(scores: Map<string, number>, ids: string[]) {
  const values = ids.map((id) => scores.get(id) ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return new Map(ids.map((id, index) => [id, max > min ? (values[index] - min) / (max - min) : 0]));
}
```

**Code làm gì:** ba thuật toán có thang điểm khác nhau nên đưa về [0, 1] trên tập ứng viên trước khi cộng. Mọi món bằng điểm nhau
(thuật toán không phân biệt được) → tất cả 0, không ảnh hưởng thứ tự.

**Ví dụ minh họa:** điểm 2, 5, 8 → 0; 0,5; 1.

**Nói với cô:** "Phải đưa điểm về cùng thang trước khi cộng, nếu không thuật toán có số to sẽ lấn át."

### 6.3. Khởi đầu lạnh và độ phổ biến — `hybrid.ts:50–57` và `hybrid.ts:66–72`

Ctrl+F: `export function coldStartWeights` / `export function withPopularity`

```ts
export function coldStartWeights(weights: Record<Algorithm, number>, interacted: number, kappa = COLD_START_KAPPA) {
  const gamma = interacted / (interacted + kappa);
  const freed = weights.collaborative * (1 - gamma);
  const others = weights.content + weights.knowledge;
  if (!others) return { ...weights, collaborative: weights.collaborative * gamma };
  return {
    content: weights.content + (freed * weights.content) / others,
    collaborative: weights.collaborative * gamma,
```

```ts
  const popularity = (1 - interacted / (interacted + kappa)) * popularityWeight0;
  return {
    content: weights.content * (1 - popularity),
    collaborative: weights.collaborative * (1 - popularity),
    knowledge: weights.knowledge * (1 - popularity),
    popularity,
  };
```

**Code làm gì:** γ = n/(n + κ), n = số món người dùng đã tương tác, κ = `COLD_START_KAPPA` = 10. Thuật toán 2 cần lịch sử nên
trọng số nhân γ; phần bớt đi chia cho thuật toán 1 và 3 theo tỷ lệ. Thêm thành phần phổ biến w_pop = (1 − γ)·w_pop0,
`POPULARITY_WEIGHT0` = 0,3 (dòng 38), các thành phần còn lại nhân (1 − w_pop) để tổng vẫn bằng 1.

**Ví dụ minh họa** ("Dành cho bạn" 0,6/0,2/0,2): người mới n = 0 → γ = 0: cộng tác 0, nội dung 0,75, tri thức 0,25; thêm phổ biến
0,3 → nội dung 0,525, tri thức 0,175, phổ biến 0,3. Người có n = 10 → γ = 0,5: cộng tác còn 0,1.

**Nói với cô:** "Người mới chưa có lịch sử thì chưa dùng được lọc cộng tác, nên hệ thống tự chuyển trọng số sang hồ sơ và món phổ
biến; dùng càng nhiều thì cộng tác càng có tiếng nói."

### 6.4. Cộng có trọng số — `hybrid.ts:81–87`

Ctrl+F: `export function blendScores`

```ts
  const keys = Object.keys(weights) as Component[];
  const normalized = new Map(keys.map((key) => [key, minMax(raw[key] ?? new Map(), ids)]));
  return ids
    .map((recipeId) => {
      const components = Object.fromEntries(keys.map((key) => [key, weights[key]! * normalized.get(key)!.get(recipeId)!])) as Partial<Record<Component, number>>;
      return { recipeId, components, score: keys.reduce((sum, key) => sum + components[key]!, 0) };
    })
```

**Code làm gì:** S = Σ w_a'·ŝ_a: chuẩn hóa từng thành phần (6.2), nhân trọng số đã chỉnh (6.3), cộng lại. `components` giữ phần
đóng góp của từng thành phần cho bước viết lý do.

**Nói với cô:** "Điểm cuối là tổng có trọng số, và hệ thống biết thành phần nào đóng góp bao nhiêu."

### 6.5. Đa dạng hóa MMR — `hybrid.ts:100–103`

Ctrl+F: `export function mmr`

```ts
    remaining.forEach((item, index) => {
      const value = lambda * item.score - (1 - lambda) * redundancy.get(item.recipeId)!;
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    });
```

**Code làm gì:** chọn lần lượt món có λ·S − (1 − λ)·(độ giống lớn nhất với các món đã chọn), λ = `MMR_LAMBDA` = 0,8 (dòng 39).
Món điểm cao nhưng gần trùng món đã chọn bị trừ, nhường chỗ cho món khác hẳn.

**Ví dụ minh họa:** món A điểm 0,9 nhưng giống món đã chọn 0,8 → 0,72 − 0,16 = 0,56; món B điểm 0,7, giống 0,1 → 0,56 − 0,02 = 0,54.
Nếu A giống 0,9 → 0,54, B được chọn trước.

**Nói với cô:** "MMR giúp danh sách gợi ý không bị toàn những món na ná nhau."

### 6.6. Lý do từ thành phần đóng góp lớn nhất — `reasons.ts:93–94` và `reasons.ts:104–111`

Ctrl+F: `export function reasonCandidates`

```ts
  const total = Object.values(contributions).reduce((sum, value) => sum + (value ?? 0), 0);
  const base = { content: 0, collaborative: 0, knowledge: 0, popularity: 0, ...(total > 0 ? contributions : weights) };
```

```ts
  if (input.content) {
    split("content", base.content, input.content.blocks, (block) => contentReason(input.content!, input.recipe.cuisine, input.hasHistory ?? true, block));
  }
  if (input.knowledge) split("knowledge", base.knowledge, input.knowledge.parts, (part) => knowledgeReason(input.knowledge!, input, part));
  if (input.collaborative && input.collaborative.score > 0) {
    const reason = collaborativeReason(input.collaborative, input.recipeName);
    if (reason) candidates.push({ text: reason, weight: base.collaborative, kind: "collaborative" });
  }
```

**Code làm gì:** đóng góp của mỗi thành phần (w'·ŝ, từ 6.4) được chia tiếp cho các tiêu chí con: khối đặc trưng của thuật toán 1,
tiêu chí của thuật toán 3. Mỗi tiêu chí sinh một câu (`contentReason` dòng 35–44, `knowledgeReason` dòng 54–71), rồi xếp theo mức
đóng góp. Mọi đóng góp bằng 0 (vd. chỉ một ứng viên) thì dùng trọng số ngữ cảnh thay thế.

**Nói với cô:** "Câu lý do không viết sẵn: nó lấy đúng tiêu chí đóng góp nhiều điểm nhất cho món đó."

### 6.7. Chọn lý do, tránh lặp trong danh sách — `reasons.ts:121–128`

Ctrl+F: `export function pickReason`

```ts
export function pickReason(candidates: ReasonCandidate[], usedKinds: Set<string>) {
  if (!candidates.length) return FALLBACK_REASON;
  const [top] = candidates;
  const chosen = usedKinds.has(top.kind)
    ? candidates.find((candidate) => !usedKinds.has(candidate.kind) && candidate.weight >= SECOND_REASON_MIN_SHARE * top.weight) ?? top
    : top;
  usedKinds.add(chosen.kind);
  return chosen.text;
```

**Code làm gì:** lý do mạnh nhất đã dùng cho món trước thì lấy lý do kế tiếp thuộc loại khác, nhưng chỉ khi nó đạt ít nhất
`SECOND_REASON_MIN_SHARE` = 25% lý do mạnh nhất (dòng 83); không có thì giữ lý do mạnh nhất. Không có lý do nào → "Hợp hồ sơ ăn uống
của bạn".

**Nói với cô:** "Danh sách không lặp một câu lý do cho mọi món, nhưng cũng không bịa lý do yếu chỉ để khác đi."

**Test:** `backend/src/modules/recommendation/hybrid.test.ts`, khối "Hybrid blending" và "runRecommendation on the seed catalog",
tiêu biểu: `"cold start: γ = n/(n+10) scales the collaborative weight and moves the rest to content and knowledge proportionally"`
(dòng 94), `"MMR avoids a list of near-duplicates: λ·score − (1−λ)·max similarity to what was picked"` (dòng 142),
`"writes the reason from the largest contributing component, then its largest sub-criterion"` (dòng 154).
Lệnh: `npx vitest run src/modules/recommendation/hybrid.test.ts`
Toàn bộ bộ gợi ý: `npx vitest run src/modules/recommendation src/test/dietary-matrix.test.ts`; đo tốc độ: `npm run test:perf`.

---

## Bảng tra nhanh

| File | Hàm / hằng | Dòng | Từ khóa Ctrl+F |
|---|---|---|---|
| hybrid.ts | `runRecommendation` (luồng chung) | 160–230 | `export function runRecommendation` |
| hybrid.ts | gọi lọc an toàn | 164 | `safeRecipes(data.recipes` |
| hybrid.ts | trọng số, trộn, MMR | 201–209 | `const weights = withPopularity` |
| safety.ts | `fitsMealType` | 20–21 | `export const fitsMealType` |
| safety.ts | `recipeFit` | 24–30 | `export function recipeFit` |
| safety.ts | `isRecipeSafe`, `safeRecipes` | 33–40 | `export function isRecipeSafe` |
| services/recipe-fit.service.ts | `recipeWarnings` (dị ứng, không thích, chay) | 76–90 | `export function recipeWarnings` |
| features.ts | `BLOCK_WEIGHTS` | 11 | `export const BLOCK_WEIGHTS` |
| features.ts | `idfOf`, `termFrequencies` | 61–71 | `export const idfOf` |
| features.ts | `nutritionBlock` | 85–93 | `export function nutritionBlock` |
| features.ts | `similarity` | 141–149 | `export function similarity` |
| interactions.ts | trọng số tương tác, `decay` | 13–21 | `export const CONTENT_WEIGHTS` |
| content-based.ts | `interactionWeight` | 49–50 | `export const interactionWeight` |
| content-based.ts | `userVector` | 53–70 | `export function userVector` |
| content-based.ts | `contentScores` | 99–104 | `export function contentScores` |
| collaborative.ts | `buildRatings` | 21–33 | `export function buildRatings` |
| collaborative.ts | co rút n/(n+λ) | 58 | `support / (support + lambda)` |
| collaborative.ts | `collaborativeScores` | 89–107 | `export function collaborativeScores` |
| collaborative.ts | `alsoCooked` (≥ 3 người khác) | 113–120 | `MIN_SUPPORT` |
| knowledge-based.ts | `KNOWLEDGE_WEIGHTS` | 19 | `export const KNOWLEDGE_WEIGHTS` |
| knowledge-based.ts | `expiringFeature` | 55–69 | `export function expiringFeature` |
| knowledge-based.ts | `pantryFeature` | 72–78 | `export function pantryFeature` |
| knowledge-based.ts | `nutritionFeature` | 81–87 | `export function nutritionFeature` |
| knowledge-based.ts | `diversityFeature` | 90–100 | `export function diversityFeature` |
| knowledge-based.ts | `knowledgeScore` | 112–130 | `export function knowledgeScore` |
| knowledge-based.ts | `mealTarget` | 148–163 | `export function mealTarget` |
| hybrid.ts | `CONTEXT_WEIGHTS` | 23–30 | `export const CONTEXT_WEIGHTS` |
| hybrid.ts | `minMax` | 42–47 | `export function minMax` |
| hybrid.ts | `coldStartWeights` | 50–60 | `export function coldStartWeights` |
| hybrid.ts | `withPopularity` | 63–73 | `export function withPopularity` |
| hybrid.ts | `blendScores` | 78–89 | `export function blendScores` |
| hybrid.ts | `mmr` | 92–114 | `export function mmr` |
| reasons.ts | `contentReason`, `knowledgeReason` | 35–71 | `export function contentReason` |
| reasons.ts | `reasonCandidates` | 90–115 | `export function reasonCandidates` |
| reasons.ts | `pickReason` | 121–129 | `export function pickReason` |

## Thứ tự mở tab khi trình bày

1. `hybrid.ts` — dòng 160 (`runRecommendation`): kể luồng tổng quát, chỉ dòng 164 (lọc an toàn trước).
2. `safety.ts` — dòng 24 → 33; mở thêm `services/recipe-fit.service.ts` dòng 76 nếu cô hỏi dị ứng tính thế nào.
3. `features.ts` — dòng 11, 61, 85, 141 (vector món, TF-IDF, cosine).
4. `interactions.ts` — dòng 13–21 (trọng số tương tác, suy giảm τ = 30 ngày).
5. `content-based.ts` — dòng 53 (`userVector`), 99 (`contentScores`).
6. `collaborative.ts` — dòng 21, 58, 89, 113.
7. `knowledge-based.ts` — dòng 19, 55, 72, 81, 90, 112.
8. Quay lại `hybrid.ts` — dòng 23, 42, 50, 78, 92 (bộ trộn).
9. `reasons.ts` — dòng 90, 121 (lý do).
10. Cuối: mở `hybrid.test.ts` hoặc chạy `npx vitest run src/modules/recommendation` để chứng minh có test.
