import { createContext, type ReactNode, useContext, useEffect, useId, useRef, useState } from "react";
import { type ConfirmOptions, type ConfirmRequest, createConfirmController } from "../../features/ui/ui.logic";
import { Button } from "./Button";

type ConfirmDialogProps = {
  request: ConfirmRequest | null;
  onAnswer: (confirmed: boolean) => void;
};

/**
 * Hộp xác nhận thay window.confirm. Dùng <dialog> gốc: showModal() khóa focus trong hộp, Esc = Hủy; bấm ra nền cũng là Hủy.
 * Focus đầu tiên ở nút Hủy (an toàn với thao tác xóa); đóng xong trả focus về phần tử đã mở hộp.
 */
export function ConfirmDialog({ request, onAnswer }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!request && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [request]);

  return (
    <dialog
      ref={dialogRef}
      className="ui-dialog"
      aria-labelledby={titleId}
      aria-describedby={request?.description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(false);
      }}
    >
      {request && (
        <form
          className="ui-dialog__body"
          onSubmit={(event) => {
            event.preventDefault();
            onAnswer(true);
          }}
        >
          <h2 id={titleId} className="ui-dialog__title">{request.title}</h2>
          {request.description && <p id={descriptionId} className="ui-dialog__description">{request.description}</p>}
          <div className="ui-dialog__actions">
            <Button onClick={() => onAnswer(false)}>{request.cancelLabel}</Button>
            <Button type="submit" variant={request.tone === "danger" ? "danger" : "primary"}>{request.confirmLabel}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Đặt một lần ở gốc ứng dụng; các trang gọi useConfirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [controller] = useState(() => createConfirmController(setRequest));
  return (
    <ConfirmContext.Provider value={controller.request}>
      {children}
      <ConfirmDialog request={request} onAnswer={controller.answer} />
    </ConfirmContext.Provider>
  );
}

/** `if (await confirm({ title: "Xóa thực đơn Tuần 44?", confirmLabel: "Xóa thực đơn" })) ...` */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm cần ConfirmProvider ở gốc ứng dụng.");
  return confirm;
}
