// Logic thuần của các thành phần giao diện dùng chung (components/ui/).

/** Ghép tên lớp, bỏ giá trị rỗng/false. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Id cho gợi ý và lỗi của ô nhập; aria-describedby chỉ trỏ tới phần đang hiển thị (lỗi đứng sau gợi ý). */
export function fieldIds(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy, invalid: Boolean(error) };
}

export type ConfirmTone = "danger" | "default";

export type ConfirmOptions = {
  /** Nêu rõ hành động + đối tượng, vd. "Xóa thực đơn Tuần 44?". */
  title: string;
  /** Hậu quả của hành động. */
  description?: string;
  /** Đúng động từ của hành động, vd. "Xóa thực đơn". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

export type ConfirmRequest = ConfirmOptions & { cancelLabel: string; tone: ConfirmTone };

/**
 * Hàng đợi một phần tử cho hộp xác nhận: request() trả Promise<boolean>; mở yêu cầu mới khi yêu cầu cũ chưa trả lời
 * thì yêu cầu cũ coi như Hủy (false). onChange báo yêu cầu đang hiển thị (null = đóng).
 */
export function createConfirmController(onChange: (request: ConfirmRequest | null) => void) {
  let pending: { request: ConfirmRequest; resolve: (confirmed: boolean) => void } | null = null;

  const settle = (confirmed: boolean) => {
    const current = pending;
    pending = null;
    current?.resolve(confirmed);
  };

  return {
    request(options: ConfirmOptions) {
      settle(false);
      const request: ConfirmRequest = { cancelLabel: "Hủy", tone: "danger", ...options };
      return new Promise<boolean>((resolve) => {
        pending = { request, resolve };
        onChange(request);
      });
    },
    answer(confirmed: boolean) {
      if (!pending) return;
      settle(confirmed);
      onChange(null);
    },
    get current() {
      return pending?.request ?? null;
    },
  };
}

/** Lời chào theo giờ địa phương (dùng ở đầu trang Tổng quan và trang mẫu). */
export function greetingForHour(hour: number) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}
