// Chế độ sáng/tối: mặc định sáng (không theo hệ điều hành), nhớ lựa chọn trong localStorage.
// Script trong index.html đọc cùng khóa và đặt data-theme trước khi vẽ trang để không nháy màu.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nouri.theme";
export const DEFAULT_THEME: Theme = "light";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** localStorage có thể không dùng được (chế độ riêng tư, bị chặn): lỗi coi như chưa chọn. */
export function readStoredTheme(storage: ReadableStorage | undefined): Theme {
  try {
    return parseTheme(storage?.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Trả về false nếu không lưu được (lựa chọn vẫn áp dụng cho lần xem hiện tại). */
export function writeStoredTheme(storage: WritableStorage | undefined, theme: Theme) {
  try {
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Đặt chế độ lên <html>: data-theme cho token CSS, color-scheme cho thanh cuộn/ô nhập của trình duyệt. */
export function applyTheme(root: { dataset: DOMStringMap; style: { colorScheme: string } }, theme: Theme) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function themeFromRoot(root: { dataset: DOMStringMap } | undefined): Theme {
  return parseTheme(root?.dataset.theme) ?? DEFAULT_THEME;
}
