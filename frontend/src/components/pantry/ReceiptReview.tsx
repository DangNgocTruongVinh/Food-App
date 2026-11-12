import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { getApiError } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import { commitReceiptScan } from "../../features/pantry/receipt-scan.api";
import {
  EMPTY_DRAFT_MESSAGE, MAX_COMMIT_LINES, providerNotice, restoreSkippedLine, reviewErrors, SKIP_REASON_LABELS, toCommitLines, toEditableLines,
  type EditableLine,
} from "../../features/pantry/receipt-scan.logic";
import { invalidatePantryQueries } from "../../features/pantry/pantry.queries";
import { cx } from "../../features/ui/ui.logic";
import type { ReceiptCommitResult, ReceiptScan } from "../../types";
import { Button, EmptyState, ErrorState, Tag } from "../ui";
import { ReceiptReviewRow } from "./ReceiptReviewRow";

type ReceiptReviewProps = {
  scan: ReceiptScan & { draft: NonNullable<ReceiptScan["draft"]> };
  onRescan: () => void;
  onManual: () => void;
  onSaved: (result: ReceiptCommitResult) => void;
};

/** Bước 3 (bắt buộc): sửa/bỏ từng dòng, khôi phục dòng bị bỏ, rồi lưu một lô vào kho. */
export function ReceiptReview({ scan, onRescan, onManual, onSaved }: ReceiptReviewProps) {
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLOListElement>(null);
  const [lines, setLines] = useState<EditableLine[]>(() => toEditableLines(scan.draft.items));
  const [restored, setRestored] = useState<ReadonlySet<number>>(new Set());
  const [invalidExpiry, setInvalidExpiry] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => (submitted ? reviewErrors(lines, invalidExpiry) : {}), [invalidExpiry, lines, submitted]);
  const chosen = lines.filter((line) => line.include).length;

  const save = useMutation({
    mutationFn: () => commitReceiptScan(scan.id, toCommitLines(lines)),
    onSuccess: (result) => {
      invalidatePantryQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.status });
      onSaved(result);
    },
  });

  const change = (key: string, patch: Partial<EditableLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const markExpiry = (key: string, invalid: boolean) => setInvalidExpiry((current) => {
    const next = new Set(current);
    if (invalid) next.add(key);
    else next.delete(key);
    return next;
  });
  const restore = (rawText: string, index: number) => {
    setLines((current) => [...current, restoreSkippedLine(rawText, index)]);
    setRestored((current) => new Set(current).add(index));
  };
  const submit = () => {
    setSubmitted(true);
    if (Object.keys(reviewErrors(lines, invalidExpiry)).length) {
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    save.mutate();
  };
  const errorCount = Object.keys(errors).length;
  const { skipped } = scan.draft;

  return (
    <div className="kho-scan">
      <p className={cx("ui-notice", scan.provider === "tesseract" && "ui-notice--error")}>
        <span>{providerNotice(scan.provider, scan.fallbackCode)}</span>
      </p>

      {lines.length ? (
        <>
          <p className="ui-text">Đọc được {lines.length} dòng hàng. Bỏ chọn dòng không muốn thêm, sửa dòng đọc sai rồi lưu.</p>
          <ol ref={listRef} className="kho-scan-list">
            {lines.map((line, index) => (
              <ReceiptReviewRow key={line.key} line={line} index={index} errors={errors[line.key] ?? {}}
                onChange={(patch) => change(line.key, patch)} onExpiryStatus={(invalid) => markExpiry(line.key, invalid)} />
            ))}
          </ol>
        </>
      ) : (
        <EmptyState message={EMPTY_DRAFT_MESSAGE} action={<Button icon={<PencilLine />} onClick={onManual}>Nhập tay</Button>} />
      )}

      {skipped.length > 0 && (
        <details className="kho-scan__skipped">
          <summary>Dòng đã bỏ qua ({skipped.length}): tổng tiền, thuế, thanh toán…</summary>
          <ul className="kho-scan-skips">
            {skipped.map((entry, index) => (
              <li key={`${index}-${entry.rawText}`} className="kho-scan-skip">
                <Tag>{SKIP_REASON_LABELS[entry.reason]}</Tag>
                <span className="kho-scan-skip__text">{entry.rawText}</span>
                <Button icon={<RotateCcw />} disabled={restored.has(index)} onClick={() => restore(entry.rawText, index)}>
                  {restored.has(index) ? "Đã khôi phục" : "Khôi phục"}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {errorCount > 0 && <ErrorState message={`Còn ${errorCount} dòng cần sửa trước khi lưu.`} />}
      {chosen > MAX_COMMIT_LINES && <ErrorState message={`Mỗi lần lưu tối đa ${MAX_COMMIT_LINES} dòng. Bỏ chọn bớt dòng.`} />}
      {save.isError && <ErrorState message={`Chưa lưu được: ${getApiError(save.error)}`} />}

      <div className="kho-form__actions">
        <Button onClick={onRescan}>Quét ảnh khác</Button>
        <Button variant="primary" busy={save.isPending} disabled={!chosen || chosen > MAX_COMMIT_LINES} onClick={submit}>
          {chosen ? `Lưu ${chosen} thực phẩm vào kho` : "Chưa chọn dòng nào"}
        </Button>
      </div>
    </div>
  );
}
