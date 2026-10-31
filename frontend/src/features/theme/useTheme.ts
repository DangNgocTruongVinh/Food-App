import { useCallback, useSyncExternalStore } from "react";
import { applyTheme, parseTheme, type Theme, THEME_STORAGE_KEY, themeFromRoot, toggleTheme, writeStoredTheme } from "./theme.logic";

// Nguồn sự thật là data-theme trên <html> (index.html đã đặt trước khi React chạy). Mọi nút chuyển dùng chung store này;
// tab khác đổi chế độ thì tab này cập nhật theo sự kiện "storage".

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function setTheme(theme: Theme) {
  applyTheme(document.documentElement, theme);
  writeStoredTheme(safeLocalStorage(), theme);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    const theme = event.key === THEME_STORAGE_KEY ? parseTheme(event.newValue) : null;
    if (theme) {
      applyTheme(document.documentElement, theme);
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => themeFromRoot(document.documentElement), () => "light" as Theme);
  const toggle = useCallback(() => setTheme(toggleTheme(themeFromRoot(document.documentElement))), []);
  return { theme, setTheme, toggle };
}
