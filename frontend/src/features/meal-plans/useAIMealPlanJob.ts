import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getApiError } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import { invalidateMealPlanQueries, mealPlanMutations, mealPlanQueries } from "./meal-plans.queries";

// Việc đã đóng thông báo (theo phiên trình duyệt): storage có thể bị chặn nên mọi truy cập đều bọc try/catch.
const DISMISSED_KEY = "nouri_ai_plan_job_dismissed";
const readDismissed = () => { try { return sessionStorage.getItem(DISMISSED_KEY); } catch { return null; } };
const writeDismissed = (id: string) => { try { sessionStorage.setItem(DISMISSED_KEY, id); } catch { /* bỏ qua */ } };

/**
 * "Tạo bằng AI (1–2 phút)": bắt đầu việc nền, hỏi trạng thái khi đang chạy (cả khi rời trang rồi quay lại), làm mới danh sách
 * thực đơn khi xong. Trả về việc cần hiện (ẩn sau khi người dùng đóng) và đồng hồ để tính thời gian đã chạy.
 */
export function useAIMealPlanJob(startDate: string) {
  const queryClient = useQueryClient();
  const job = useQuery(mealPlanQueries.aiJob());
  const [dismissed, setDismissed] = useState(readDismissed);
  const [startError, setStartError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const running = job.data?.status === "RUNNING";
  const lastStatus = useRef(job.data?.status);

  const start = useMutation({
    ...mealPlanMutations.startAI(startDate),
    onSuccess: (started) => { queryClient.setQueryData(queryKeys.mealPlans.aiJob, started); setStartError(""); },
    onError: (error) => setStartError(getApiError(error)),
  });

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Đang chạy → xong: tải lại danh sách thực đơn (và Tổng quan) để thấy thực đơn mới.
  useEffect(() => {
    if (lastStatus.current === "RUNNING" && job.data?.status === "DONE") invalidateMealPlanQueries(queryClient, true);
    lastStatus.current = job.data?.status;
  }, [job.data?.status, queryClient]);

  const dismiss = () => { if (job.data) { writeDismissed(job.data.id); setDismissed(job.data.id); } };
  const visible = job.data && job.data.id !== dismissed ? job.data : null;
  return { job: visible, running, now, start, startError, dismiss };
}
