import { editDistance } from "../profile/allergy-groups";

/**
 * Gợi ý tự động dùng chung cho mọi ô tìm kiếm / ô nhập có danh sách (component components/ui/Combobox.tsx).
 * Khớp không dấu, không phân biệt hoa thường, nhiều từ theo thứ tự bất kỳ, sai nhẹ (1 ký tự với từ ≥ 4 chữ);
 * mục khớp đầu tên lên trước. Tối đa 8 mục.
 */
export type ComboOption = {
  id: string;
  label: string;
  /** Chữ nhỏ bên phải: "nhóm Trứng", "ẩn theo hồ sơ", "Nguyên liệu"… */
  detail?: string;
  /** Chữ tìm thêm, không hiện (vd. nguyên liệu của món, email). */
  keywords?: string[];
  /** Giá trị điền vào ô khi chọn (mặc định là label), vd. email của người dùng. */
  value?: string;
};

export const MAX_COMBO_OPTIONS = 8;
export const COMBO_DEBOUNCE_MS = 150;

/** Bỏ dấu từng ký tự, giữ nguyên độ dài (để in đậm đúng vị trí trên chữ có dấu). */
export function foldChars(value: string) {
  const foldChar = (char: string) => char.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().slice(0, 1) || char;
  return [...value].map((char) => (char === "đ" || char === "Đ" ? "d" : foldChar(char))).join("");
}

const words = (value: string) => foldChars(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Một từ của câu tìm khớp một từ của tên: khớp đầu từ; từ ≥ 4 chữ cho sai 1 ký tự. */
function wordMatches(queryWord: string, word: string) {
  if (word.startsWith(queryWord)) return true;
  return queryWord.length >= 4 && editDistance(queryWord, word.slice(0, queryWord.length)) <= 1;
}

/**
 * Hạng: 0 = trùng hẳn tên ("lac" → "Lạc" trước "Lactose"), 1 = tên bắt đầu bằng câu tìm, 2 = mọi từ khớp đầu từ trong tên,
 * 3 = khớp tên khi cho sai nhẹ, 4 = cần chữ tìm thêm (nguyên liệu, email…); null = không khớp.
 */
export function optionRank(option: ComboOption, query: string): number | null {
  const queryWords = words(query);
  if (!queryWords.length) return null;
  const labelWords = words(option.label);
  if (labelWords.join(" ") === queryWords.join(" ")) return 0;
  if (foldChars(option.label.trim()).startsWith(foldChars(query.trim()))) return 1;
  if (queryWords.every((queryWord) => labelWords.some((word) => word.startsWith(queryWord)))) return 2;
  if (queryWords.every((queryWord) => labelWords.some((word) => wordMatches(queryWord, word)))) return 3;
  const allWords = [...labelWords, ...(option.keywords ?? []).flatMap(words)];
  return queryWords.every((queryWord) => allWords.some((word) => wordMatches(queryWord, word))) ? 4 : null;
}

/** Lọc + xếp hạng (cùng hạng giữ thứ tự gốc), bỏ trùng tên, tối đa `limit`. */
export function rankOptions(options: ComboOption[], query: string, limit = MAX_COMBO_OPTIONS) {
  const seen = new Set<string>();
  return options
    .map((option, index) => ({ option, index, rank: optionRank(option, query) }))
    .filter((entry): entry is { option: ComboOption; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .filter(({ option }) => {
      const key = foldChars(option.label.trim());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ option }) => option);
}

/** Tách tên thành đoạn thường / đoạn in đậm (phần khớp đầu từ với từng từ của câu tìm, không dấu). */
export function highlightParts(label: string, query: string): Array<{ text: string; match: boolean }> {
  const folded = foldChars(label);
  const marks = new Array<boolean>(label.length).fill(false);
  for (const queryWord of words(query)) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${queryWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "u");
    const found = pattern.exec(folded);
    if (!found) continue;
    const start = found.index + found[1].length;
    for (let index = start; index < start + queryWord.length; index += 1) marks[index] = true;
  }
  const parts: Array<{ text: string; match: boolean }> = [];
  [...label].forEach((char, index) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[index]) last.text += char;
    else parts.push({ text: char, match: marks[index] });
  });
  return parts;
}

export type ComboState = { open: boolean; active: number };
export type ComboCommand = "select" | "enter" | "close" | null;

/**
 * Bàn phím của ô gợi ý: ↑↓ chọn (vòng), Enter chọn mục đang chọn — không chọn mục nào thì "enter" (giữ hành vi cũ của ô:
 * tìm, thêm…), Esc đóng (chỉ khi đang mở, để Esc lần hai vẫn đóng hộp thoại chứa ô), Tab đóng.
 */
export function comboKey(state: ComboState, key: string, count: number): { state: ComboState; command: ComboCommand } {
  if (key === "ArrowDown") return { state: { open: true, active: count ? (state.active + 1) % count : -1 }, command: null };
  if (key === "ArrowUp") return { state: { open: true, active: count ? (state.active <= 0 ? count - 1 : state.active - 1) : -1 }, command: null };
  if (key === "Enter") {
    const select = state.open && state.active >= 0 && state.active < count;
    return { state: { open: false, active: -1 }, command: select ? "select" : "enter" };
  }
  if (key === "Escape") return state.open ? { state: { open: false, active: -1 }, command: "close" } : { state, command: null };
  if (key === "Tab") return { state: { open: false, active: -1 }, command: null };
  return { state, command: null };
}
