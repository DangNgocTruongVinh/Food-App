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
  /** Tên chứa cụm này thì KHÔNG thuộc nhóm dù có từ của nhóm ("sữa đậu nành" không phải sữa bò). */
  excludes?: string[];
  /** Nhóm gộp: chọn nhóm này = chọn các nhóm con (Hải sản = Cá + Giáp xác + Nhuyễn thể). */
  covers?: string[];
};

const PLANT_MILKS = ["sữa đậu nành", "sữa hạnh nhân", "sữa óc chó", "sữa hạt", "sữa dừa", "sữa yến mạch", "sữa gạo", "sữa bắp"];

export const ALLERGY_GROUPS: AllergyGroup[] = [
  {
    id: "EGG", label: "Trứng",
    aliases: ["trứng", "trứng gà", "trứng vịt", "trứng cút", "trứng gà ta", "lòng đỏ", "lòng trắng", "egg", "eggs"],
    terms: ["trứng", "lòng đỏ", "lòng trắng", "mayonnaise", "sốt mayonnaise", "sốt mayo"],
  },
  {
    id: "MILK", label: "Sữa",
    aliases: ["sữa", "sữa bò", "sản phẩm từ sữa", "lactose", "đạm sữa", "milk", "dairy"],
    terms: ["sữa", "sữa tươi", "sữa chua", "sữa đặc", "sữa bột", "phô mai", "pho mát", "bơ lạt", "bơ nhạt", "bơ động vật", "kem tươi", "whey", "cheese"],
    excludes: [...PLANT_MILKS, "sữa chua đậu nành"],
  },
  {
    id: "SEAFOOD", label: "Hải sản",
    aliases: ["hải sản", "thủy sản", "đồ biển", "seafood"], terms: [], covers: ["FISH", "CRUSTACEAN", "MOLLUSC"],
  },
  {
    id: "FISH", label: "Cá",
    aliases: ["cá", "fish", "cá biển", "cá sông"],
    terms: ["cá", "cá hồi", "cá lóc", "cá basa", "cá thu", "cá ngừ", "cá rô", "cá diêu hồng", "cá cơm", "nước mắm", "mắm", "mắm nêm", "dầu cá"],
  },
  {
    id: "CRUSTACEAN", label: "Giáp xác",
    aliases: ["giáp xác", "tôm cua", "shrimp", "crab", "shellfish"],
    terms: ["tôm", "tôm sú", "tôm thẻ", "tôm khô", "tép", "cua", "ghẹ", "mắm tôm", "ruốc", "tôm hùm"],
  },
  {
    id: "MOLLUSC", label: "Nhuyễn thể",
    aliases: ["nhuyễn thể", "thân mềm", "squid", "clam", "oyster"],
    terms: ["mực", "bạch tuộc", "nghêu", "ngao", "sò", "hến", "ốc", "hàu", "sò điệp", "vẹm", "dầu hào"],
  },
  {
    id: "PEANUT", label: "Đậu phộng",
    aliases: ["đậu phộng", "lạc", "peanut", "peanuts"],
    terms: ["đậu phộng", "lạc", "lạc rang", "bơ đậu phộng", "dầu đậu phộng", "dầu lạc"],
  },
  {
    id: "TREE_NUT", label: "Hạt cây",
    aliases: ["hạt cây", "các loại hạt", "hạt", "tree nut", "tree nuts", "nuts"],
    terms: ["óc chó", "hạnh nhân", "hạt điều", "hạt dẻ", "hạt phỉ", "hồ đào", "mắc ca", "macca", "hạt thông", "hạt dẻ cười", "sữa hạnh nhân", "sữa óc chó"],
  },
  {
    id: "GLUTEN", label: "Gluten",
    aliases: ["gluten", "lúa mì", "bột mì", "wheat"],
    terms: ["bột mì", "bánh mì", "mì ý", "mì trứng", "mì gói", "bột chiên giòn", "bột chiên xù", "lúa mì", "lúa mạch", "pasta"],
  },
  {
    id: "SOY", label: "Đậu nành",
    aliases: ["đậu nành", "đỗ tương", "đậu tương", "soy", "soya"],
    terms: ["đậu nành", "đỗ tương", "đậu tương", "sữa đậu nành", "đậu hũ", "đậu phụ", "tàu hũ", "tào phớ", "nước tương", "xì dầu", "tương đen", "tương bần", "tương hột", "miso", "chao", "tempeh", "edamame"],
  },
  {
    id: "SESAME", label: "Mè",
    aliases: ["mè", "vừng", "sesame"],
    terms: ["mè", "vừng", "mè rang", "dầu mè", "dầu vừng", "muối mè", "tahini"],
  },
];

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
const groupsCache = new Map<string, AllergyGroup[]>();
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

/** Tên nguyên liệu/món thuộc nhóm nào (có tính ngoại lệ: "Sữa đậu nành" thuộc Đậu nành, không thuộc Sữa). */
export function groupsOfFoodName(name: string) {
  return remember(groupsCache, name, () => ALLERGY_GROUPS.filter((group) => !group.covers
    && !(group.excludes ?? []).some((phrase) => containsTerm(name, phrase, { exact: true }))
    && group.terms.some((term) => containsTerm(name, term, { exact: true }))));
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
