import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { PantryItem } from "../../types";
import { PANTRY_PAGE_SIZE, pantryItemPage } from "./pantry.logic";

type PantryItemFocusOptions = {
  items: PantryItem[];
  ready: boolean;
  /** Danh sách đã lọc/sắp xếp và phần đang hiện ở trang hiện tại. */
  filtered: PantryItem[];
  visibleItems: PantryItem[];
  /** Ổn định giữa các lần render (useCallback). */
  clearFilters: () => void;
  setPage: (page: number) => void;
};

export const pantryItemElementId = (id: string) => `pantry-item-${id}`;

/**
 * Mở đúng dòng thực phẩm: từ link thông báo (/pantry?item=...) hoặc từ cột "Cần dùng sớm".
 * Bỏ bộ lọc để dòng chắc chắn hiện ra, chuyển tới trang chứa dòng, cuộn tới, đưa focus vào dòng và làm nổi bật.
 * Gọi sau effect đưa danh sách về trang 1 khi bộ lọc đổi, để trang của dòng là giá trị cuối cùng trong cùng lần commit.
 */
export function usePantryItemFocus({ items, ready, filtered, visibleItems, clearFilters, setPage }: PantryItemFocusOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusParam = searchParams.get("item");
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [focusMissing, setFocusMissing] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const pendingPageFocus = useRef<string | null>(null);
  const pendingScroll = useRef<string | null>(null);

  const focusItem = useCallback((itemId: string) => {
    clearFilters();
    setFocusedItemId(itemId);
    setFocusMissing(false);
    pendingPageFocus.current = itemId;
    setFocusRequest((value) => value + 1);
  }, [clearFilters]);

  // Link thông báo: item còn thì mở, không còn thì báo; xử lý xong thì xóa tham số khỏi URL.
  useEffect(() => {
    if (!focusParam || !ready) return;
    if (items.some((item) => item.id === focusParam)) focusItem(focusParam);
    else {
      setFocusedItemId(null);
      setFocusMissing(true);
    }
    setSearchParams((params) => { params.delete("item"); return params; }, { replace: true });
  }, [focusItem, focusParam, items, ready, setSearchParams]);

  useEffect(() => {
    const itemId = pendingPageFocus.current;
    if (!itemId) return;
    const targetPage = pantryItemPage(filtered, itemId, PANTRY_PAGE_SIZE);
    if (targetPage === null) return;
    pendingPageFocus.current = null;
    pendingScroll.current = itemId;
    setPage(targetPage);
  }, [filtered, focusRequest, setPage]);

  useEffect(() => {
    const itemId = pendingScroll.current;
    if (!itemId || !visibleItems.some((item) => item.id === itemId)) return;
    pendingScroll.current = null;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(pantryItemElementId(itemId));
      if (!element) return;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
      element.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleItems]);

  return { focusedItemId, focusMissing, dismissMissing: () => setFocusMissing(false), focusItem };
}
