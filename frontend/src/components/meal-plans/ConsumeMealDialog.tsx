import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "../../api/query-keys";
import {
  consumptionLineDetail, consumptionStatusLabel, formatAmount, initialSelections, isLineSelectable, type LineSelection, selectionErrors, toConsumption,
} from "../../features/meal-plans/consumption.logic";
import { getConsumptionPreview, type MealConsumption } from "../../features/meal-plans/meal-plans.api";
import type { ConsumeTarget } from "../../features/meal-plans/useMealConsumption";
import { cx } from "../../features/ui/ui.logic";
import type { ConsumptionLine } from "../../types";
import { foodUnitLabel } from "../../utils/units";
import { Button, Dialog, ErrorState, LoadingState, Skeleton } from "../ui";

type ConsumeMealDialogProps = {
  target: ConsumeTarget;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (consumption: MealConsumption) => void;
};

function ConsumeLine({ line, selection, error, onChange }: {
  line: ConsumptionLine; selection: LineSelection; error?: string; onChange: (next: LineSelection) => void;
}) {
  const status = consumptionStatusLabel(line);
  const selectable = isLineSelectable(line);
  const id = `td-consume-${line.ingredientId}`;
  const detail = consumptionLineDetail(line);
  return (
    <li className={cx("td-consume__line", !selection.included && "is-off")}>
      <div className="td-consume__head">
        <input
          id={id}
          type="checkbox"
          className="td-consume__check"
          checked={selection.included}
          disabled={!selectable}
          aria-describedby={`${id}-detail`}
          onChange={(event) => onChange({ ...selection, included: event.target.checked })}
        />
        <label htmlFor={id} className="td-consume__name">{line.name}</label>
        <span className={`td-consume__status td-consume__status--${status.tone}`}>{status.text}</span>
      </div>
      <p id={`${id}-detail`} className="td-consume__detail">
        Cần {formatAmount(line.required.quantity, line.required.unit)}.
        {detail && ` ${detail}`}
      </p>
      {selectable && (
        <div className="td-consume__amount">
          <label htmlFor={`${id}-qty`}>Lượng trừ</label>
          <span className="td-consume__input">
            <input
              id={`${id}-qty`}
              className="ui-input"
              inputMode="decimal"
              value={selection.quantity}
              disabled={!selection.included}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => onChange({ ...selection, quantity: event.target.value })}
            />
            <span aria-hidden="true">{foodUnitLabel[line.required.unit]}</span>
          </span>
          {error && <span id={`${id}-error`} className="ui-field__error">{error}</span>}
        </div>
      )}
    </li>
  );
}

/**
 * Hộp "Đã ăn" (Tổng quan và Thực đơn): xem trước từng nguyên liệu sẽ trừ khỏi kho (hạn sớm trước), sửa lượng hoặc bỏ từng dòng,
 * rồi "Trừ kho và đánh dấu đã ăn" hoặc "Chỉ đánh dấu, không trừ kho". Dòng tùy chọn và chỉ còn món hết hạn mặc định không trừ.
 */
export function ConsumeMealDialog({ target, busy, error, onClose, onConfirm }: ConsumeMealDialogProps) {
  const preview = useQuery({
    queryKey: queryKeys.mealPlans.consumptionPreview(target.id),
    queryFn: () => getConsumptionPreview(target.id),
    staleTime: 0,
    gcTime: 0,
  });
  const lines = preview.data?.lines ?? [];
  const [selections, setSelections] = useState<Record<string, LineSelection>>({});
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (preview.data) setSelections(initialSelections(preview.data.lines));
  }, [preview.data]);

  const errors = submitted ? selectionErrors(lines, selections) : {};
  const chosenCount = lines.filter((line) => selections[line.ingredientId]?.included && isLineSelectable(line)).length;
  const noneMatch = preview.isSuccess && !lines.some(isLineSelectable);

  const deduct = () => {
    setSubmitted(true);
    const invalid = selectionErrors(lines, selections);
    const first = lines.find((line) => invalid[line.ingredientId]);
    if (first) {
      document.getElementById(`td-consume-${first.ingredientId}-qty`)?.focus();
      return;
    }
    onConfirm(toConsumption(lines, selections));
  };

  return (
    <Dialog
      title={`Đã ăn: ${target.recipeName}`}
      description="Chọn nguyên liệu trừ khỏi kho. Thực phẩm hạn sớm được trừ trước; nguyên liệu tùy chọn và thực phẩm đã hết hạn chỉ bị trừ khi bạn chọn."
      onClose={onClose}
      className="td-consume"
    >
      {preview.isLoading ? (
        <LoadingState label="Đang xem trước nguyên liệu">
          {[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={72} />)}
        </LoadingState>
      ) : preview.isError ? (
        <ErrorState message="Chưa xem trước được nguyên liệu của bữa này." onRetry={() => void preview.refetch()} retrying={preview.isFetching} />
      ) : (
        <>
          {noneMatch && <p className="ui-notice">Không nguyên liệu nào của món này khớp với kho. Bạn vẫn có thể đánh dấu đã ăn.</p>}
          <ul className="td-consume__list" aria-label="Nguyên liệu của bữa">
            {lines.map((line) => (
              <ConsumeLine
                key={line.ingredientId}
                line={line}
                selection={selections[line.ingredientId] ?? { included: false, quantity: "" }}
                error={errors[line.ingredientId]}
                onChange={(next) => setSelections((current) => ({ ...current, [line.ingredientId]: next }))}
              />
            ))}
          </ul>
        </>
      )}
      {error && <p className="ui-notice ui-notice--error" role="alert">Chưa lưu được: {error}</p>}
      <div className="ui-dialog__actions td-consume__actions">
        <Button disabled={busy} onClick={() => onConfirm({ mode: "none" })}>Chỉ đánh dấu, không trừ kho</Button>
        <Button variant="primary" busy={busy} disabled={!preview.isSuccess || !chosenCount} onClick={deduct}>Trừ kho và đánh dấu đã ăn</Button>
      </div>
    </Dialog>
  );
}
