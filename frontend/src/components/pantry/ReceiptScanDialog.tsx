import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getReceiptScanStatus } from "../../features/pantry/receipt-scan.api";
import { useReceiptScan } from "../../features/pantry/useReceiptScan";
import type { ReceiptCommitResult } from "../../types";
import { Dialog } from "../ui";
import { ReceiptReview } from "./ReceiptReview";
import { ReceiptScanPicker } from "./ReceiptScanPicker";
import { ReceiptScanProgress } from "./ReceiptScanProgress";

type ReceiptScanDialogProps = {
  onClose: () => void;
  /** Mở hộp Thêm thực phẩm (nhập tay) thay cho quét. */
  onManual: () => void;
  onSaved: (result: ReceiptCommitResult) => void;
};

/** "Quét hóa đơn" (GĐ3c): chọn/chụp ảnh → tiến trình → màn duyệt bắt buộc → lưu một lô vào kho. */
export function ReceiptScanDialog({ onClose, onManual, onSaved }: ReceiptScanDialogProps) {
  const scan = useReceiptScan();
  const status = useQuery({ queryKey: queryKeys.receiptScans.status, queryFn: getReceiptScanStatus });
  const { state } = scan;
  const busy = state.kind === "uploading" || state.kind === "processing";
  // Đóng khi đang tải/đọc: hủy luôn lần quét để server không giữ lần quét đang chạy.
  const close = () => {
    if (busy) scan.cancel();
    onClose();
  };
  const reviewing = state.kind === "review" && state.scan.draft;

  return (
    <Dialog
      title={reviewing ? "Kiểm tra trước khi lưu" : "Quét hóa đơn"}
      description={reviewing ? "Chỉ những dòng được chọn mới thêm vào kho. Lưu xong vẫn hoàn tác được cả hóa đơn." : undefined}
      onClose={close}
      className="kho-dialog kho-scan-dialog"
    >
      {state.kind === "uploading" && <ReceiptScanProgress stage="uploading" fraction={state.fraction} onCancel={scan.cancel} />}
      {state.kind === "processing" && (
        <ReceiptScanProgress stage={scan.current?.phase ?? "queued"} fraction={scan.current?.progress ?? null} onCancel={scan.cancel} />
      )}
      {state.kind === "review" && state.scan.draft && (
        <ReceiptReview scan={{ ...state.scan, draft: state.scan.draft }} onRescan={scan.reset} onManual={onManual} onSaved={onSaved} />
      )}
      {(state.kind === "pick" || state.kind === "error") && (
        <ReceiptScanPicker
          status={status.data}
          statusError={status.isError}
          error={state.kind === "error" ? state : null}
          onPick={(file, mode) => void scan.start(file, mode)}
          onManual={onManual}
        />
      )}
    </Dialog>
  );
}
