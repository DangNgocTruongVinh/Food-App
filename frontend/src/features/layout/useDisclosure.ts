import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Menu thả (disclosure): nút có aria-expanded/aria-controls, vùng nội dung ngay sau nút trong DOM (Tab đi tiếp vào trong).
 * Đóng khi: bấm Esc (trả focus về nút), bấm ra ngoài, chuyển trang, hoặc focus rời khỏi vùng (Tab ra ngoài).
 */
export function useDisclosure<TRoot extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<TRoot>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { pathname } = useLocation();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, close]);

  return {
    open,
    rootRef,
    panelId,
    close,
    buttonProps: {
      ref: buttonRef,
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setOpen((value) => !value),
    },
  };
}
