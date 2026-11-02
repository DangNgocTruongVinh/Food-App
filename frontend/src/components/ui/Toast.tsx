import { Check } from "lucide-react";
import { useEffect } from "react";

const TOAST_MS = 5000;

/**
 * Xác nhận một hành động bằng đúng động từ của nút ("Đã lưu vào kho"). Tự ẩn sau 5 giây;
 * vùng role="status" luôn có trong trang để trình đọc màn hình đọc thông báo mới.
 */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className="ui-toast-region" role="status" aria-live="polite">
      {message && (
        <p className="ui-toast">
          <Check aria-hidden="true" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
