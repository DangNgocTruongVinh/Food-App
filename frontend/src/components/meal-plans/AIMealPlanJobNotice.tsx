import type { MealPlanJob } from "../../features/meal-plans/meal-plans.api";
import { aiJobMessage, aiJobProgress, mealPlanPath } from "../../features/meal-plans/meal-plans.logic";
import { Button, ButtonLink } from "../ui";

type AIMealPlanJobNoticeProps = { job: MealPlanJob; now: number; onDismiss: () => void; onRetry: () => void };

/** Thông báo việc "Tạo bằng AI": tiến trình (ước tính theo thời gian) khi đang chạy; kết quả/lý do dùng thuật toán khi xong. */
export function AIMealPlanJobNotice({ job, now, onDismiss, onRetry }: AIMealPlanJobNoticeProps) {
  const running = job.status === "RUNNING";
  return (
    <div className={job.status === "FAILED" ? "ui-notice ui-notice--error td-ai-job" : "ui-notice td-ai-job"} role="status">
      <span>{aiJobMessage(job, now)}</span>
      {running && (
        <progress className="td-ai-job__progress" max={100} value={aiJobProgress(job, now)} aria-label="Tiến trình tạo thực đơn bằng AI" />
      )}
      {!running && (
        <span className="td-ai-job__actions">
          {job.planId && <ButtonLink to={mealPlanPath(job.planId)} onClick={onDismiss}>Xem thực đơn</ButtonLink>}
          {job.status === "FAILED" && <Button onClick={onRetry}>Thử lại</Button>}
          <Button onClick={onDismiss}>Đóng</Button>
        </span>
      )}
    </div>
  );
}
