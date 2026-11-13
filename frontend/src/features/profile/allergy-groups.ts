/**
 * Danh mục nhóm dị ứng dùng chung (dị ứng, món không thích, nhãn chay, gợi ý ô nhập, Admin nhận nhóm nguyên liệu).
 * BẢN GỐC: backend/src/services/allergy-groups.ts; frontend/src/features/profile/allergy-groups.ts là bản chép y nguyên
 * (test frontend so hai file, sửa ở đây rồi chép sang). Không import gì để hai phía dùng được.
 *
 * Nguyên tắc an toàn: người dùng gõ kiểu gì cũng không bị bỏ sót, không bao giờ im lặng bỏ qua một mục:
 * - Tên nhóm, tên gọi khác (hai miền, tiếng Anh) hoặc (với dị ứng) bất kỳ nguyên liệu nào của nhóm → tránh cả nhóm.
 * - Không thuộc nhóm nào → vẫn lọc theo đúng chữ đó (nguyên từ, hai chiều).
 * - Khớp gần đúng (sai 1–2 ký tự) chỉ để GỢI Ý ("Có phải bạn muốn: Trứng?"), không tự áp.
 */
export type AllergyGroup = {
  id: string;
  label: string;
  /** Tên gọi khác: hai miền, tiếng Anh, cách gõ thường gặp. Gõ một tên này = chọn cả nhóm (kể cả ở "Món không thích"). */
  aliases: string[];
  /** Nguyên liệu thuộc nhóm (so nguyên từ với tên nguyên liệu và tên món). */
  terms: string[];
  /**
   * Nguyên liệu chế biến "có thể chứa" (tùy nhãn hàng, vd. tương đen thường có bột mì). Vẫn bị lọc khi dị ứng (an toàn trước),
   * nhưng thẻ món ghi "Có thể chứa: …" thay vì "Chứa: …". Không dùng cho "Món không thích".
   */
  mayContain?: string[];
  /** Tên chứa cụm này thì KHÔNG thuộc nhóm dù có từ của nhóm ("sữa đậu nành" không phải sữa bò). */
  excludes?: string[];
  /** Nhóm gộp: chọn nhóm này = chọn các nhóm con (Hải sản = Cá + Giáp xác + Nhuyễn thể). */
  covers?: string[];
};

/** Tiền tố nhãn của nhóm "có thể chứa" (backend dựng nhãn, frontend tách ra để ghi "Có thể chứa: …"). */
export const MAY_CONTAIN_PREFIX = "Có thể chứa ";

const PLANT_MILKS = ["sữa đậu nành", "sữa hạnh nhân", "sữa óc chó", "sữa hạt", "sữa dừa", "sữa yến mạch", "sữa gạo", "sữa bắp"];

export const ALLERGY_GROUPS: AllergyGroup[] = [
  {
    id: "EGG", label: "Trứng",
    aliases: ["trứng", "trứng gà", "trứng vịt", "trứng cút", "trứng gà ta", "lòng đỏ", "lòng trắng", "egg", "eggs"],
    terms: ["trứng", "lòng đỏ", "lòng trắng", "mayonnaise", "sốt mayonnaise", "sốt mayo", "mayo", "sốt trứng"],
  },
  {
    id: "MILK", label: "Sữa",
    aliases: ["sữa", "sữa bò", "sản phẩm từ sữa", "lactose", "đạm sữa", "milk", "dairy"],
    terms: [
      "sữa", "sữa tươi", "sữa chua", "sữa đặc", "sữa bột", "phô mai", "pho mát", "bơ", "bơ lạt", "bơ nhạt", "bơ động vật", "kem", "kem tươi",
      "kem sữa", "váng sữa", "whey", "cheese", "butter",
    ],
    // "Bơ" một mình là bơ sữa; "quả bơ"/"trái bơ"/"sinh tố bơ" là trái cây, "bơ đậu phộng" thuộc Đậu phộng.
    excludes: [...PLANT_MILKS, "sữa chua đậu nành", "quả bơ", "trái bơ", "sinh tố bơ", "bơ đậu phộng", "bơ thực vật", "kem dừa"],
  },
  {
    id: "SEAFOOD", label: "Hải sản",
    aliases: ["hải sản", "thủy sản", "đồ biển", "seafood"], terms: [], covers: ["FISH", "CRUSTACEAN", "MOLLUSC"],
  },
  {
    id: "FISH", label: "Cá",
    aliases: ["cá", "fish", "cá biển", "cá sông"],
    terms: [
      "cá", "cá hồi", "cá lóc", "cá basa", "cá thu", "cá ngừ", "cá rô", "cá diêu hồng", "cá cơm", "nước mắm", "mắm", "mắm nêm", "dầu cá",
      "mắm cá", "mắm cá linh", "mắm thái",
    ],
  },
  {
    id: "CRUSTACEAN", label: "Giáp xác",
    aliases: ["giáp xác", "tôm cua", "shrimp", "crab", "shellfish"],
    terms: ["tôm", "tôm sú", "tôm thẻ", "tôm khô", "tép", "cua", "ghẹ", "mắm tôm", "ruốc", "mắm ruốc", "tôm hùm", "gạch cua", "bánh phồng tôm"],
  },
  {
    id: "MOLLUSC", label: "Nhuyễn thể",
    aliases: ["nhuyễn thể", "thân mềm", "squid", "clam", "oyster"],
    terms: ["mực", "bạch tuộc", "nghêu", "ngao", "sò", "hến", "ốc", "hàu", "sò điệp", "vẹm", "dầu hào", "sốt dầu hào"],
  },
  {
    id: "PEANUT", label: "Đậu phộng",
    aliases: ["đậu phộng", "lạc", "peanut", "peanuts"],
    terms: ["đậu phộng", "lạc", "lạc rang", "bơ đậu phộng", "dầu đậu phộng", "dầu lạc", "sốt đậu phộng", "muối đậu phộng"],
    mayContain: ["sa tế", "tương đậu phộng", "nước chấm gỏi cuốn"],
  },
  {
    id: "TREE_NUT", label: "Hạt cây",
    aliases: ["hạt cây", "các loại hạt", "hạt", "tree nut", "tree nuts", "nuts"],
    terms: ["óc chó", "hạnh nhân", "hạt điều", "hạt dẻ", "hạt phỉ", "hồ đào", "mắc ca", "macca", "hạt thông", "hạt dẻ cười", "sữa hạnh nhân", "sữa óc chó"],
  },
  {
    id: "GLUTEN", label: "Gluten",
    aliases: ["gluten", "lúa mì", "bột mì", "wheat"],
    terms: [
      "bột mì", "bánh mì", "mì", "mì ý", "mì trứng", "mì gói", "bột chiên giòn", "bột chiên xù", "lúa mì", "lúa mạch", "pasta",
      "nước tương", "xì dầu", "vỏ bánh bao", "bánh bao", "mì căn", "seitan",
    ],
    // Tùy nhãn hàng: tương đen (hoisin), tương ớt Hàn Quốc (gochujang), dầu hào thường có bột mì; yến mạch, bún tàu dễ lẫn lúa mì.
    mayContain: ["tương đen", "tương ớt hàn quốc", "gochujang", "dầu hào", "sốt dầu hào", "miso", "yến mạch", "bún tàu", "bột năng trộn"],
    // "Mì" là lúa mì, trừ mì chính (bột ngọt) và mì Quảng (bột gạo).
    excludes: ["mì chính", "mì quảng"],
  },
  {
    id: "SOY", label: "Đậu nành",
    aliases: ["đậu nành", "đỗ tương", "đậu tương", "soy", "soya"],
    terms: [
      "đậu nành", "đỗ tương", "đậu tương", "sữa đậu nành", "đậu hũ", "đậu phụ", "tàu hũ", "tào phớ", "tàu hũ ky", "váng đậu", "nước tương",
      "xì dầu", "tương đen", "tương bần", "tương hột", "tương ớt hàn quốc", "gochujang", "miso", "chao", "tempeh", "edamame",
    ],
    mayContain: ["dầu hào", "sốt dầu hào", "hạt nêm chay"],
  },
  {
    id: "SESAME", label: "Mè",
    aliases: ["mè", "vừng", "sesame"],
    terms: ["mè", "vừng", "mè rang", "dầu mè", "dầu vừng", "muối mè", "tahini", "sốt mè"],
    mayContain: ["tương đen", "sốt mè rang"],
  },
];

/**
 * Nguyên liệu chế biến / gia vị / thành phần ẩn của các nhóm. DỊ ỨNG tính cả những thứ này (an toàn trước); MÓN KHÔNG THÍCH
 * (khẩu vị) thì không: không thích "cá" vẫn ăn được món có nước mắm. Ghi đích danh ("nước mắm") thì mới lọc gia vị đó.
 */
export const PROCESSED_FOOD_TERMS = new Set([
  "nước mắm", "mắm", "mắm nêm", "dầu cá", "mắm cá", "mắm cá linh", "mắm thái", "mắm tôm", "ruốc", "mắm ruốc", "bánh phồng tôm", "gạch cua",
  "dầu hào", "sốt dầu hào", "mayonnaise", "sốt mayonnaise", "sốt mayo", "mayo", "sốt trứng", "whey", "nước tương", "xì dầu", "tương đen",
  "tương bần", "tương hột", "tương ớt hàn quốc", "gochujang", "miso", "chao", "bột chiên giòn", "bột chiên xù", "vỏ bánh bao",
  "dầu đậu phộng", "dầu lạc", "sốt đậu phộng", "muối đậu phộng", "bơ đậu phộng", "dầu mè", "dầu vừng", "muối mè", "tahini", "sốt mè",
  "sữa hạnh nhân", "sữa óc chó", "sữa đậu nành",
]);

/** Nguyên liệu chính của nhóm (bỏ chế biến/gia vị) — dùng cho "Món không thích". */
export const mainTermsOf = (group: AllergyGroup) => group.terms.filter((term) => !PROCESSED_FOOD_TERMS.has(term));

const BY_ID = new Map(ALLERGY_GROUPS.map((group) => [group.id, group]));
// Từ thừa người dùng hay gõ kèm ("dị ứng trứng", "bị dị ứng với tôm"): bỏ trước khi so.
const FILLER_WORDS = new Set(["di", "ung", "bi", "voi", "mon", "toi", "allergy", "allergic"]);

/** Gọn khoảng trắng, chữ thường, bỏ dấu câu; giữ dấu tiếng Việt. */
export function normalizeAllergyText(value: string) {
  return value.trim().toLocaleLowerCase("vi").normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** normalizeAllergyText rồi bỏ dấu: "Trứng Gà" → "trung ga". Bỏ từng ký tự nên giữ nguyên độ dài (dùng để in đậm phần khớp). */
export function foldAllergyText(value: string) {
  return [...normalizeAllergyText(value)].map((char) => (char === "đ" ? "d" : char.normalize("NFD").replace(/\p{M}+/gu, ""))).join("");
}

const hasMarks = (value: string) => normalizeAllergyText(value) !== foldAllergyText(value);

/** Bỏ từ thừa ("dị ứng", "bị", "với", "món"); trả về chữ đã chuẩn hóa (còn dấu nếu người dùng gõ dấu). */
export function stripFillerWords(value: string) {
  return normalizeAllergyText(value).split(" ").filter((word) => word && !FILLER_WORDS.has(foldAllergyText(word))).join(" ");
}

/** Nhóm thật (mở nhóm gộp thành nhóm con). */
export function expandGroups(groups: AllergyGroup[]) {
  return [...new Set(groups.flatMap((group) => (group.covers ? group.covers.map((id) => BY_ID.get(id)!) : [group])))];
}

/** So một cụm của danh mục (có dấu) với cụm người dùng gõ: có dấu thì so có dấu, không dấu thì so không dấu. */
const sameTerm = (typed: string, term: string) =>
  hasMarks(typed) ? normalizeAllergyText(term) === typed : foldAllergyText(term) === foldAllergyText(typed);

export type ResolvedRestriction = { input: string; groups: AllergyGroup[]; text: string | null };

/**
 * Một mục người dùng nhập → nhóm (đã mở nhóm gộp) hoặc chữ tự do (text) để lọc theo đúng chữ đó.
 * strict (dị ứng): trùng tên nhóm, tên gọi khác HOẶC một nguyên liệu của nhóm → cả nhóm.
 * Không strict (món không thích): chỉ tên nhóm/tên gọi khác → nhóm; tên nguyên liệu ("cá hồi") giữ là chữ.
 */
export function resolveRestriction(raw: string, { strict = true } = {}): ResolvedRestriction {
  return remember(resolveCache, `${strict ? 1 : 0}${raw}`, () => resolveUncached(raw, strict));
}

// Bộ nhớ đệm nhỏ: bộ gợi ý kiểm hàng nghìn món với cùng hồ sơ và cùng tên nguyên liệu.
const resolveCache = new Map<string, ResolvedRestriction>();
const matchesCache = new Map<string, FoodAllergyMatch[]>();
function remember<T>(cache: Map<string, T>, key: string, compute: () => T) {
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 5000) cache.clear(); // shortcut: xóa cả bộ đệm khi quá lớn; đủ cho danh mục vài nghìn nguyên liệu
  const value = compute();
  cache.set(key, value);
  return value;
}

function resolveUncached(raw: string, strict: boolean): ResolvedRestriction {
  const typed = stripFillerWords(raw) || normalizeAllergyText(raw);
  if (!typed) return { input: raw, groups: [], text: null };
  const byName = ALLERGY_GROUPS.filter((group) => [group.label, ...group.aliases].some((name) => sameTerm(typed, name)));
  const byTerm = strict && !byName.length ? ALLERGY_GROUPS.filter((group) => group.terms.some((term) => sameTerm(typed, term))) : [];
  const groups = expandGroups(byName.length ? byName : byTerm);
  return { input: raw, groups, text: groups.length ? null : typed };
}

// So khớp nguyên từ trên chữ đã đệm khoảng trắng hai đầu: "ốc" không khớp "quốc", "cá" không khớp "cà chua".
const padded = (value: string) => ` ${normalizeAllergyText(value)} `;
const paddedFolded = (value: string) => ` ${foldAllergyText(value)} `;

/**
 * Cụm `term` có trong `text` (nguyên từ). Chữ người dùng gõ không dấu thì so không dấu ("trung" ↔ "Trứng"); cụm của danh mục
 * (exact) luôn so đúng dấu ("chao" là đậu phụ lên men, không khớp "cháo").
 */
export function containsTerm(text: string, term: string, { exact = false } = {}) {
  const folded = !exact && !hasMarks(term);
  return (folded ? paddedFolded(text) : padded(text)).includes(folded ? paddedFolded(term) : padded(term));
}

export type FoodAllergyMatch = { group: AllergyGroup; certain: boolean };

/**
 * Tên nguyên liệu/món thuộc nhóm nào, kèm độ chắc chắn: certain = chứa chắc chắn (terms), false = "có thể chứa" (mayContain).
 * Có tính ngoại lệ ("Sữa đậu nành" thuộc Đậu nành, không thuộc Sữa). Một nguyên liệu có thể thuộc nhiều nhóm (Nước tương:
 * Đậu nành + Gluten).
 */
export function allergyMatchesOfFoodName(name: string): FoodAllergyMatch[] {
  return remember(matchesCache, name, () => ALLERGY_GROUPS.flatMap((group): FoodAllergyMatch[] => {
    if (group.covers || (group.excludes ?? []).some((phrase) => containsTerm(name, phrase, { exact: true }))) return [];
    if (group.terms.some((term) => containsTerm(name, term, { exact: true }))) return [{ group, certain: true }];
    if ((group.mayContain ?? []).some((term) => containsTerm(name, term, { exact: true }))) return [{ group, certain: false }];
    return [];
  }));
}

/** Các nhóm của một tên (cả "chứa" lẫn "có thể chứa"). */
export function groupsOfFoodName(name: string) {
  return allergyMatchesOfFoodName(name).map((match) => match.group);
}

/** Khoảng cách sửa (Levenshtein) giữa hai chuỗi ngắn. */
export function editDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Gợi ý gần đúng khi không nhận ra (sai 1 ký tự với từ ≤ 6 chữ, 2 ký tự với từ dài hơn). Chỉ để hỏi lại, không tự áp. */
export function suggestAllergyGroup(raw: string): AllergyGroup | null {
  const typed = foldAllergyText(stripFillerWords(raw) || raw);
  if (typed.length < 2 || resolveRestriction(raw).groups.length) return null;
  const limit = typed.length <= 6 ? 1 : 2;
  let best: { group: AllergyGroup; distance: number } | null = null;
  for (const group of ALLERGY_GROUPS) {
    for (const name of [group.label, ...group.aliases, ...group.terms]) {
      const candidate = foldAllergyText(name);
      if (candidate.length < 3) continue; // "cá", "mè", "sò": quá ngắn, sai 1 ký tự là thành từ khác
      const distance = editDistance(typed, candidate);
      if (distance <= limit && (!best || distance < best.distance)) best = { group, distance };
    }
  }
  return best?.group ?? null;
}
