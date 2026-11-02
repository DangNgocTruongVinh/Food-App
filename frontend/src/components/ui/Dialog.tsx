import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { cx } from "../../features/ui/ui.logic";
import { IconButton } from "./Button";

const FOCUSABLE = [
  "button:not([disabled])", "input:not([disabled]):not([tabindex='-1'])", "select:not([disabled])", "textarea:not([disabled])", "a[href]", "[tabindex='0']",
].join(", ");

/** Phần tử nhận Tab trong hộp thoại; nhóm radio chỉ tính nút đang chọn (Tab vào nhóm dừng ở nút đó). */
function dialogFocusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked));
}

type DialogProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * Hộp thoại có nội dung (form). Mở khi được gắn vào cây, đóng khi bị gỡ. Dùng <dialog> gốc như ConfirmDialog:
 * showModal() khóa focus, Esc gọi onClose, đóng xong trả focus về phần tử đã mở hộp.
 * Bấm ra nền không đóng để không mất dữ liệu đang nhập.
 */
export function Dialog({ title, description, onClose, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      returnFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={cx("ui-dialog", "ui-dialog--form", className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        // showModal() không giữ Tab: sau phần tử cuối, Chrome chuyển focus ra thanh trình duyệt. Vòng lại trong hộp.
        if (event.key !== "Tab" || !dialogRef.current) return;
        const focusable = dialogFocusables(dialogRef.current);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header className="ui-dialog__header">
        <div className="ui-dialog__heading">
          <h2 id={titleId} className="ui-dialog__form-title">{title}</h2>
          {description && <p id={descriptionId} className="ui-dialog__description">{description}</p>}
        </div>
        <IconButton label="Đóng" icon={<X />} quiet onClick={onClose} />
      </header>
      {children}
    </dialog>
  );
}
