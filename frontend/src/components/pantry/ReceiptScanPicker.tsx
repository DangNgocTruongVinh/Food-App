import { Camera, ImageUp, PencilLine } from "lucide-react";
import { useRef, useState } from "react";
import { PROVIDER_LABELS, scanModeOptions } from "../../features/pantry/receipt-scan.logic";
import type { ReceiptScanMode, ReceiptScanStatus } from "../../types";
import { Button, ChoiceGroup, ErrorState, LoadingState } from "../ui";

type ReceiptScanPickerProps = {
  status: ReceiptScanStatus | undefined;
  statusError: boolean;
  error: { message: string; quota: boolean } | null;
  onPick: (file: File, mode: ReceiptScanMode) => void;
  onManual: () => void;
};

/** Bước 1: chụp ảnh (điện thoại mở camera sau) hoặc chọn ảnh có sẵn; số lượt còn lại, chế độ đọc; lỗi lần trước. */
export function ReceiptScanPicker({ status, statusError, error, onPick, onManual }: ReceiptScanPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ReceiptScanMode>("auto");
  if (!status && !statusError) return <LoadingState label="Đang tải chế độ quét hóa đơn" count={2} />;

  const provider = status?.defaultProvider ?? null;
  const unavailable = status && !provider ? status.providers.find((option) => option.reason)?.reason : null;
  const outOfScans = status ? status.remainingToday <= 0 : false;
  const blocked = Boolean(unavailable) || outOfScans;
  const pick = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (file) onPick(file, mode);
  };
  const modes = scanModeOptions(status);
  const manual = <Button icon={<PencilLine />} onClick={onManual}>Nhập tay</Button>;

  return (
    <div className="kho-scan">
      {error && (
        <div className="kho-scan__error">
          <ErrorState message={error.message} />
          {error.quota && manual}
        </div>
      )}
      {statusError && <ErrorState message="Chưa tải được trạng thái quét hóa đơn. Bạn vẫn có thể thử chọn ảnh." />}
      {unavailable && <p className="ui-notice ui-notice--error"><span>{unavailable}</span>{manual}</p>}
      {status && outOfScans && !unavailable && (
        <p className="ui-notice ui-notice--error"><span>Bạn đã dùng hết {status.dailyLimit} lần quét hôm nay. Thử lại vào ngày mai.</span>{manual}</p>
      )}

      <p className="ui-text">Chụp hoặc chọn ảnh hóa đơn, nhãn sản phẩm. Nouri đọc các dòng hàng để bạn kiểm tra trước khi thêm vào kho.</p>
      <ul className="kho-scan__tips">
        <li>Chụp thẳng, đủ sáng, cả tờ hóa đơn nằm trong khung.</li>
        <li>Ảnh JPG, PNG hoặc WEBP, tối đa 5 MB. Ảnh chỉ dùng để đọc rồi bỏ, không lưu lại.</li>
      </ul>
      {modes && (
        <ChoiceGroup legend="Chế độ đọc" name="receipt-mode" options={modes} value={mode} onChange={(value) => setMode(value as ReceiptScanMode)}
          hint="Tự động: đọc bằng AI, lỗi thì tự chuyển sang chế độ dự phòng (đọc trên máy chủ)." />
      )}
      {status && (
        <p className="kho-sub">
          {provider && !modes && <>Chế độ đọc: {PROVIDER_LABELS[provider]}. </>}
          Còn {status.remainingToday}/{status.dailyLimit} lần quét hôm nay.
        </p>
      )}

      <input ref={cameraRef} className="ui-visually-hidden" type="file" accept="image/*" capture="environment" tabIndex={-1}
        aria-hidden="true" onChange={(event) => pick(event.currentTarget)} />
      <input ref={fileRef} className="ui-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/*" tabIndex={-1}
        aria-hidden="true" onChange={(event) => pick(event.currentTarget)} />
      <div className="kho-form__actions">
        {!error?.quota && !blocked && manual}
        <Button icon={<ImageUp />} disabled={blocked} onClick={() => fileRef.current?.click()}>Chọn ảnh có sẵn</Button>
        <Button variant="primary" icon={<Camera />} disabled={blocked} onClick={() => cameraRef.current?.click()}>Chụp hóa đơn</Button>
      </div>
    </div>
  );
}
