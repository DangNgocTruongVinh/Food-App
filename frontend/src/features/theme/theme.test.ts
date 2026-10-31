import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { applyTheme, parseTheme, readStoredTheme, THEME_STORAGE_KEY, themeFromRoot, toggleTheme, writeStoredTheme } from "./theme.logic";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
};

describe("theme preference", () => {
  it("defaults to light when nothing (or something invalid) is stored", () => {
    expect(readStoredTheme(memoryStorage())).toBe("light");
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "blue" }))).toBe("light");
    expect(readStoredTheme(undefined)).toBe("light");
  });

  it("restores the stored choice", () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
  });

  it("falls back to light / reports failure when storage throws (private mode, blocked site data)", () => {
    const throwing = { getItem: vi.fn(() => { throw new Error("SecurityError"); }), setItem: vi.fn(() => { throw new Error("QuotaExceeded"); }) };
    expect(readStoredTheme(throwing)).toBe("light");
    expect(writeStoredTheme(throwing, "dark")).toBe(false);
    expect(writeStoredTheme(undefined, "dark")).toBe(false);
  });

  it("writes the choice under the shared key", () => {
    const storage = memoryStorage();
    expect(writeStoredTheme(storage, "dark")).toBe(true);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("toggles, parses and applies the theme to the root element", () => {
    expect(toggleTheme("light")).toBe("dark");
    expect(toggleTheme("dark")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme(null)).toBeNull();
    const root = { dataset: {} as DOMStringMap, style: { colorScheme: "" } };
    applyTheme(root, "dark");
    expect(root).toEqual({ dataset: { theme: "dark" }, style: { colorScheme: "dark" } });
    expect(themeFromRoot(root)).toBe("dark");
    expect(themeFromRoot({ dataset: {} })).toBe("light");
  });

  it("index.html sets the theme before the app loads, with the same key and a try/catch", () => {
    const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
    const inline = html.slice(html.indexOf("<script>"), html.indexOf("</script>"));
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
    expect(inline).toContain(`"${THEME_STORAGE_KEY}"`);
    expect(inline).toContain("try");
    expect(inline).toContain('setAttribute("data-theme", theme)');
  });
});
