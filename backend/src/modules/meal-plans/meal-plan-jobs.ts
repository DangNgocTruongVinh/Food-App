import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { generateWeeklyPlan, type PlanFallbackReason } from "./meal-plans.service.js";

/**
 * "Tạo bằng AI (1–2 phút)": chạy nền. POST trả ngay (202), giao diện hỏi trạng thái qua GET; người dùng rời trang thì việc vẫn chạy,
 * xong có thông báo (MEAL_PLAN_CREATED). Mỗi người một việc đang chạy. OpenAI lỗi/hết giờ → bộ tạo thuật toán, ghi lý do.
 * shortcut: lưu trong bộ nhớ một tiến trình (khởi động lại backend thì mất việc đang chạy); nhiều máy chủ thì chuyển sang bảng DB.
 */
export type MealPlanJob = {
  id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  startDate: string;
  startedAt: string;
  finishedAt: string | null;
  planId: string | null;
  /** Khác null: đã dùng bộ tạo thuật toán thay AI. */
  fallbackReason: PlanFallbackReason | null;
  error: string | null;
  /** Nội bộ (không trả về): để test chờ việc xong. */
  done?: Promise<void>;
};

const jobs = new Map<string, MealPlanJob>();
type Generate = typeof generateWeeklyPlan;

const FALLBACK_NOTE: Record<PlanFallbackReason, string> = {
  AI_NOT_CONFIGURED: "chưa cấu hình AI",
  AI_TIMEOUT: "AI quá 2 phút chưa trả lời",
  AI_ERROR: "AI đang gặp lỗi",
  AI_INVALID: "kết quả AI không hợp lệ",
};

export function currentMealPlanJob(userId: string) {
  return publicJob(jobs.get(userId) ?? null);
}

/** Chỉ cho test: chờ mọi việc nền xong; clear = xóa bộ nhớ sau đó. */
export async function settleMealPlanJobsForTest({ clear = false } = {}) {
  await Promise.all([...jobs.values()].map((job) => job.done));
  if (clear) jobs.clear();
}

export function startMealPlanJob(userId: string, startDate: string, generate: Generate = generateWeeklyPlan, now = new Date()) {
  if (jobs.get(userId)?.status === "RUNNING") throw new HttpError(409, "Đang tạo thực đơn bằng AI, vui lòng chờ xong.");
  const job: MealPlanJob = {
    id: `job-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, status: "RUNNING", startDate,
    startedAt: now.toISOString(), finishedAt: null, planId: null, fallbackReason: null, error: null,
  };
  jobs.set(userId, job);
  job.done = generate(userId, startDate, { useAI: true })
    .then(async (plan) => {
      Object.assign(job, { status: "DONE", planId: plan.id, fallbackReason: plan.generation.fallbackReason, finishedAt: new Date().toISOString() });
      const reason = plan.generation.fallbackReason;
      await prisma.notification.create({
        data: {
          userId, type: "MEAL_PLAN_CREATED", relatedId: plan.id, actionUrl: `/meal-plans/${plan.id}`,
          title: reason ? "Thực đơn đã tạo bằng thuật toán" : "Thực đơn AI đã sẵn sàng",
          message: reason ? `Không dùng được AI (${FALLBACK_NOTE[reason]}) nên Nouri đã tạo bằng thuật toán.` : "Mở thực đơn để xem và áp dụng.",
        },
      }).catch((error: unknown) => console.warn("Không tạo được thông báo thực đơn:", error));
    })
    .catch((error: unknown) => {
      Object.assign(job, {
        status: "FAILED", finishedAt: new Date().toISOString(),
        error: error instanceof HttpError ? error.message : "Chưa tạo được thực đơn. Hãy thử lại.",
      });
    });
  return publicJob(job);
}

/** Bỏ trường nội bộ (promise) khỏi dữ liệu trả về. */
export function publicJob(job: MealPlanJob | null) {
  if (!job) return null;
  const { done: _done, ...rest } = job;
  return rest;
}
