import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { CHUNK_RELOAD_KEY, claimChunkReload, isChunkLoadError } from "./error-recovery.logic";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
};

describe("Khôi phục khi lỗi tải file JS sau khi build lại", () => {
  it("nhận ra lỗi tải chunk của các trình duyệt, bỏ qua lỗi khác", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: http://x/assets/DashboardPage-1.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Minified React error #310"))).toBe(false);
  });

  it("tự tải lại đúng một lần trong 10 giây (không lặp vô hạn), lỗi khác không tải lại", () => {
    const store = memory();
    const error = new TypeError("Failed to fetch dynamically imported module");
    expect(claimChunkReload(error, store, 1_000)).toBe(true);
    expect(store.getItem(CHUNK_RELOAD_KEY)).toBe("1000");
    expect(claimChunkReload(error, store, 5_000)).toBe(false);
    expect(claimChunkReload(error, store, 12_000)).toBe(true);
    expect(claimChunkReload(new Error("khác"), memory(), 1_000)).toBe(false);
    expect(claimChunkReload(error, null, 1_000)).toBe(false);
  });

  it("Error Boundary hiện nội dung bình thường khi không lỗi", () => {
    expect(renderToStaticMarkup(createElement(ErrorBoundary, null, createElement("p", null, "Tổng quan")))).toBe("<p>Tổng quan</p>");
    expect(ErrorBoundary.getDerivedStateFromError(new Error("x")).error).toBeInstanceOf(Error);
  });
});
