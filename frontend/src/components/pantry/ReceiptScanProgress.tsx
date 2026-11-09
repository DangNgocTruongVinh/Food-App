import { Check, Circle, LoaderCircle } from "lucide-react";
import { SCAN_STEPS, scanStageText, scanStepOf, type ScanStage } from "../../features/pantry/receipt-scan.logic";
import { cx } from "../../features/ui/ui.logic";
import { Button } from "../ui";

type ReceiptScanProgressProps = { stage: ScanStage; fraction: number | null; onCancel: () => void };

/** Bước 2: ba bước (tải ảnh, đọc chữ, phân tích) theo trạng thái API; thanh % khi có; nút Hủy. */
export function ReceiptScanProgress({ stage, fraction, onCancel }: ReceiptScanProgressProps) {
  const current = SCAN_STEPS.findIndex(({ step }) => step === scanStepOf(stage));
  const text = scanStageText(stage, fraction);
  return (
    <div className="kho-scan">
      <ol className="kho-scan-steps">
        {SCAN_STEPS.map(({ step, label }, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} className={cx(done && "is-done", active && "is-current")} aria-current={active ? "step" : undefined}>
              <span aria-hidden="true" className="kho-scan-steps__icon">{done ? <Check /> : active ? <LoaderCircle /> : <Circle />}</span>
              <span>{label}</span>
              {done && <span className="ui-visually-hidden">(xong)</span>}
            </li>
          );
        })}
      </ol>
      <div role="status" aria-live="polite" className="kho-scan__status">
        <p className="ui-text">{text}</p>
        {fraction === null
          ? <progress className="kho-scan__bar" aria-label={text} />
          : <progress className="kho-scan__bar" aria-label={text} max={1} value={fraction} />}
      </div>
      <p className="kho-sub">Chế độ dự phòng có thể mất vài chục giây với hóa đơn dài.</p>
      <div className="kho-form__actions">
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </div>
  );
}
