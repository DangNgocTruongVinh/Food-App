import type { MealNotice } from "../../features/meal-plans/useMealConsumption";
import { Button } from "../ui";

/** Dòng nhắc sau khi đánh dấu/bỏ đánh dấu đã ăn (Tổng quan, Thực đơn): tóm tắt kho; đánh dấu xong có "Hoàn tác". */
export function MealStatusNotice({ notice, busy, onUndo }: { notice: MealNotice | null; busy: boolean; onUndo: (notice: MealNotice) => void }) {
  if (!notice) return null;
  const error = notice.kind === "error";
  return (
    <p className={error ? "ui-notice ui-notice--error" : "ui-notice"} role={error ? "alert" : "status"}>
      {notice.message}
      {notice.kind === "done" && <Button busy={busy} onClick={() => onUndo(notice)}>Hoàn tác</Button>}
    </p>
  );
}
