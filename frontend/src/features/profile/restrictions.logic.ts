import type { ComboOption } from "../ui/combobox.logic";
import { allergyGroups, foldAllergyText, mainTermsOf, resolveRestriction, suggestAllergyGroup } from "./allergy-groups";
import { addTag } from "./profile.logic";

// Ô "Dị ứng" và "Món không thích" ở Hồ sơ: gợi ý từ danh mục nhóm dị ứng dùng chung (cùng bản với bộ lọc ở backend).

export type RestrictionKind = "allergy" | "dislike";
const strictOf = (kind: RestrictionKind) => kind === "allergy";
const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase("vi") + value.slice(1);

/** Gợi ý: tên nhóm, tên gọi khác, nguyên liệu thuộc nhóm; bên phải ghi "nhóm <tên nhóm>". */
export function restrictionOptions(): ComboOption[] {
  const seen = new Set<string>();
  return allergyGroups().flatMap((group) => [group.label, ...group.aliases, ...group.terms].map((name) => ({ name, group })))
    .filter(({ name }) => {
      const key = foldAllergyText(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ name, group }) => ({ id: `${group.id}:${name}`, label: capitalize(name), detail: `nhóm ${group.label}` }));
}

export type RestrictionAdd = {
  tags: string[];
  error: string | null;
  /** Mục chưa nhận ra: vẫn thêm, kèm câu nhắc. */
  notice: string | null;
  /** Gợi ý gần đúng ("Có phải bạn muốn: Trứng?"), chỉ để người dùng bấm chọn, không tự áp. */
  suggestion: string | null;
};

/**
 * Thêm một mục: dị ứng thuộc một nhóm thì lưu tên nhóm ("trứng gà" → "Trứng"); không cho trùng nhóm đã chọn;
 * mục không nhận ra vẫn thêm (lọc theo đúng chữ) kèm câu nhắc và gợi ý gần đúng nếu có.
 */
export function addRestrictionTag(tags: string[], raw: string, max: number, kind: RestrictionKind): RestrictionAdd {
  const strict = strictOf(kind);
  const resolved = resolveRestriction(raw, { strict });
  const value = kind === "allergy" && resolved.groups.length === 1 ? resolved.groups[0].label : raw;
  if (resolved.groups.length) {
    const taken = new Set(tags.flatMap((tag) => resolveRestriction(tag, { strict }).groups.map((group) => group.id)));
    if (resolved.groups.every((group) => taken.has(group.id))) {
      const names = resolved.groups.map((group) => group.label).join(", ");
      return { tags, error: `Đã có nhóm ${names} trong danh sách.`, notice: null, suggestion: null };
    }
  }
  const added = addTag(tags, value, max);
  if (added.error || added.tags === tags || resolved.groups.length) return { ...added, notice: null, suggestion: null };
  const text = raw.trim().replace(/\s+/g, " ");
  return {
    ...added,
    notice: `Nouri chưa nhận ra “${text}” — sẽ lọc theo đúng chữ này.`,
    suggestion: suggestAllergyGroup(raw)?.label ?? null,
  };
}

/** Dòng "Sẽ tránh: Trứng (trứng, lòng đỏ, lòng trắng…), “cần tây”" dưới ô nhập; không có mục nào thì null. */
export function avoidSummary(tags: string[], kind: RestrictionKind) {
  const parts = new Map<string, string>();
  for (const tag of tags) {
    const resolved = resolveRestriction(tag, { strict: strictOf(kind) });
    for (const group of resolved.groups) {
      // Món không thích chỉ nêu nguyên liệu chính (không gia vị/thành phần ẩn như nước mắm).
      const list = kind === "allergy" ? group.terms : mainTermsOf(group);
      parts.set(group.id, `${group.label} (${list.slice(0, 3).join(", ")}${list.length > 3 ? "…" : ""})`);
    }
    if (resolved.text) parts.set(`text:${resolved.text}`, `“${resolved.text}”`);
  }
  return parts.size ? `Sẽ tránh: ${[...parts.values()].join(", ")}` : null;
}
