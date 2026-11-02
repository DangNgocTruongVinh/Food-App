import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { addDays, format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiError } from "../api/client";
import { queryKeys } from "../api/query-keys";
import { dayTabId, MealDayTabs } from "../components/meal-plans/MealDayTabs";
import { MealDayList } from "../components/meal-plans/MealDayList";
import { MealPlanCreateForm } from "../components/meal-plans/MealPlanCreateForm";
import { MealPlanHeader } from "../components/meal-plans/MealPlanHeader";
import { MealPlanNutritionCard, MealPlanSuggestionsCard } from "../components/meal-plans/MealPlanSide";
import { MealPlansSkeleton } from "../components/meal-plans/MealPlansSkeleton";
import { ShoppingListCard } from "../components/meal-plans/ShoppingListCard";
import { Button, EmptyState, ErrorState, Toast, useConfirm } from "../components/ui";
import { aiQueries } from "../features/ai/ai.queries";
import {
  dayNutrition, generateSourceLabel, initialDayIndex, latestMealPlanId, mealPlanDeleteConfirm, mealPlanPath, mealPlanSuggestions,
  nextMealPlanIdAfterDelete, planTargets, selectMealPlanDay, summarizeMealPlan, todayDayIndex,
} from "../features/meal-plans/meal-plans.logic";
import {
  invalidateMealPlanQueries, mealPlanMutations, mealPlanQueries, removeDeletedMealPlan, removeMealPlanDetail,
} from "../features/meal-plans/meal-plans.queries";
import { profileQueries } from "../features/profile/profile.queries";
import type { MealPlan, MealPlanItem } from "../types";
import { type DateDraftStatus, formatDisplayDate } from "../utils/date";

type MealPlansLocationState = { notice?: string } | null;
type MealStatus = { kind: "done" | "undone" | "error"; item: MealPlanItem; message?: string };
const DAY_PANEL_ID = "td-day-panel";

export default function MealPlansPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { id: routeId } = useParams();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [dateStatus, setDateStatus] = useState<DateDraftStatus>("valid");
  const [error, setError] = useState("");
  const [mealStatus, setMealStatus] = useState<MealStatus | null>(null);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const notice = (location.state as MealPlansLocationState)?.notice ?? "";

  const list = useQuery(mealPlanQueries.list());
  const data = useMemo(() => list.data ?? [], [list.data]);
  const { data: profileData } = useQuery(profileQueries.detail());
  const { data: aiStatus } = useQuery(aiQueries.status());
  // Thực đơn đang chọn lấy từ URL và tải bằng GET /meal-plans/:id; dữ liệu đã có trong danh sách dùng làm dữ liệu ban đầu.
  const detail = useQuery({
    ...mealPlanQueries.detail(routeId ?? ""),
    enabled: Boolean(routeId),
    initialData: () => queryClient.getQueryData<MealPlan[]>(queryKeys.mealPlans.list())?.find((plan) => plan.id === routeId),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.mealPlans.list())?.dataUpdatedAt,
  });
  const detailStatus = axios.isAxiosError(detail.error) ? detail.error.response?.status : undefined;

  // /meal-plans không kèm id → mở thực đơn mới nhất.
  useEffect(() => {
    if (!routeId && data.length) navigate(mealPlanPath(latestMealPlanId(data)), { replace: true, state: location.state });
  }, [data, location.state, navigate, routeId]);

  // Thực đơn không tồn tại hoặc không thuộc người dùng → báo ngắn và về thực đơn mới nhất còn lại.
  useEffect(() => {
    if (!routeId || (detailStatus !== 404 && detailStatus !== 422)) return;
    const fallbackId = nextMealPlanIdAfterDelete(data, routeId);
    navigate(mealPlanPath(fallbackId), { replace: true, state: { notice: "Không tìm thấy thực đơn này. Đã chuyển về thực đơn mới nhất." } });
  }, [data, detailStatus, navigate, routeId]);

  // Bỏ cache chi tiết của thực đơn vừa xóa khi trang đã rời khỏi nó (điều hướng của React Router chạy trong transition).
  const deletedPlanId = useRef<string | null>(null);
  useEffect(() => {
    const id = deletedPlanId.current;
    if (!id || routeId === id) return;
    removeMealPlanDetail(queryClient, id);
    deletedPlanId.current = null;
  }, [queryClient, routeId]);

  const selected = routeId ? detail.data ?? data.find((plan) => plan.id === routeId) : undefined;
  // Mở thực đơn: chọn sẵn hôm nay (nếu thuộc thực đơn); đổi ngày sau đó chỉ đổi state, không tải lại trang.
  useEffect(() => {
    if (selected) setSelectedDayIndex(initialDayIndex(selected));
    setMealStatus(null);
  }, [selected?.id]); // chỉ khi đổi thực đơn, không chạy lại khi dữ liệu thực đơn được làm mới

  const week = useMemo(() => summarizeMealPlan(selected), [selected]);
  const targets = planTargets(profileData?.profile);

  const generate = useMutation({
    ...mealPlanMutations.generate(startDate),
    onSuccess: (plan) => {
      invalidateMealPlanQueries(queryClient, true);
      navigate(mealPlanPath(plan.id));
      setError("");
      setToast(`Đã tạo “${plan.name}”.`);
    },
    onError: (err) => setError(getApiError(err)),
  });
  const updateMeal = useMutation({ ...mealPlanMutations.updateMeal(), onSuccess: () => invalidateMealPlanQueries(queryClient, true) });
  const toggleShop = useMutation({ ...mealPlanMutations.updateShopping(), onSuccess: () => invalidateMealPlanQueries(queryClient, false) });
  const activate = useMutation({
    ...mealPlanMutations.updateStatus(),
    onSuccess: (plan) => { invalidateMealPlanQueries(queryClient, true); setToast(`Đã áp dụng “${plan.name}”.`); },
    onError: (err) => setError(getApiError(err)),
  });
  const remove = useMutation({
    ...mealPlanMutations.remove(),
    onSuccess: (_result, deletedId) => {
      const nextId = nextMealPlanIdAfterDelete(data, deletedId);
      removeDeletedMealPlan(queryClient, deletedId);
      deletedPlanId.current = deletedId;
      navigate(mealPlanPath(nextId), { replace: true });
      setError("");
    },
    onError: (err) => setError(getApiError(err)),
  });

  const setCompleted = (item: MealPlanItem, completed: boolean) => {
    updateMeal.mutate({ id: item.id, completed }, {
      onSuccess: () => setMealStatus({ kind: completed ? "done" : "undone", item }),
      onError: (err) => setMealStatus({ kind: "error", item, message: getApiError(err) }),
    });
  };
  const confirmRemove = async (plan: MealPlan) => {
    if (!(await confirm({ ...mealPlanDeleteConfirm(plan), tone: "danger" }))) return;
    remove.mutate(plan.id, { onSuccess: () => setToast(`Đã xóa “${plan.name}”.`) });
  };

  const createForm = (
    <MealPlanCreateForm
      startDate={startDate}
      dateStatus={dateStatus}
      onStartDateChange={(value, status) => { setStartDate(value); setDateStatus(status); }}
      onSubmit={() => generate.mutate()}
      pending={generate.isPending}
      aiAvailable={aiStatus?.available}
    />
  );
  const generatingNotice = generate.isPending && (
    <p className="ui-notice" role="status">
      Đang tạo thực đơn 7 ngày từ {formatDisplayDate(startDate)} ({generateSourceLabel(aiStatus?.available).toLowerCase()}).
      {aiStatus?.available ? " AI có thể mất tới vài chục giây." : " Thường xong trong vài giây."}
    </p>
  );
  const messages = (
    <>
      {error && <ErrorState message={error} />}
      {notice && <p className="ui-notice" role="status">{notice}</p>}
      {generatingNotice}
    </>
  );
  const toastRegion = <Toast message={toast} onDone={clearToast} />;

  if (list.isLoading || (routeId && !selected && detail.isLoading)) {
    return <div className="td-view"><MealPlansSkeleton /></div>;
  }
  if (list.isError || (routeId && !selected && detail.isError && detailStatus !== 404 && detailStatus !== 422)) {
    const retry = () => void (list.isError ? list.refetch() : detail.refetch());
    return (
      <div className="td-view">
        <ErrorState message="Chưa tải được thực đơn." onRetry={retry} retrying={list.isFetching || detail.isFetching} />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="td-view">
        <header className="td-hero">
          <div className="td-hero__text">
            <h1 className="ui-title">Thực đơn <em>của bạn</em></h1>
            <p className="ui-text">
              Nouri xếp bữa sáng, trưa, tối cho 7 ngày theo hồ sơ dinh dưỡng và kho của bạn, kèm danh sách đi chợ.
            </p>
          </div>
        </header>
        {messages}
        {generate.isPending ? <MealPlansSkeleton label="Đang tạo thực đơn" /> : (
          <div className="td-empty">
            <EmptyState message="Bạn chưa có thực đơn nào. Chọn ngày bắt đầu rồi bấm Tạo thực đơn." action={createForm} />
          </div>
        )}
        {toastRegion}
      </div>
    );
  }

  const day = selectMealPlanDay(selected, selectedDayIndex)!;
  const dayIndex = selected.days.indexOf(day);
  const todayIndex = todayDayIndex(selected);

  return (
    <div className="td-view">
      <MealPlanHeader
        plan={selected}
        plans={data}
        onSelectPlan={(id) => navigate(mealPlanPath(id))}
        onActivate={() => activate.mutate({ id: selected.id, status: "ACTIVE" })}
        activating={activate.isPending}
        onDelete={() => void confirmRemove(selected)}
        deleting={remove.isPending}
        createForm={createForm}
      />
      {messages}

      <div className="td-layout">
        <div className="td-main">
          <MealDayTabs days={selected.days} selectedIndex={dayIndex} todayIndex={todayIndex} panelId={DAY_PANEL_ID} onSelect={setSelectedDayIndex} />
          {mealStatus && (
            <p className={mealStatus.kind === "error" ? "ui-notice ui-notice--error" : "ui-notice"} role={mealStatus.kind === "error" ? "alert" : "status"}>
              {mealStatus.kind === "done" && <>Đã đánh dấu đã ăn: {mealStatus.item.recipe.name}.</>}
              {mealStatus.kind === "undone" && <>Đã bỏ đánh dấu đã ăn: {mealStatus.item.recipe.name}.</>}
              {mealStatus.kind === "error" && <>Chưa cập nhật được bữa {mealStatus.item.recipe.name}. {mealStatus.message}</>}
              {mealStatus.kind === "done" && <Button busy={updateMeal.isPending} onClick={() => setCompleted(mealStatus.item, false)}>Hoàn tác</Button>}
            </p>
          )}
          <MealDayList
            plan={selected}
            day={day}
            isToday={dayIndex === todayIndex}
            panelId={DAY_PANEL_ID}
            labelledBy={dayTabId(dayIndex)}
            pendingId={updateMeal.isPending ? updateMeal.variables?.id ?? null : null}
            onToggle={setCompleted}
          />
        </div>

        <aside className="td-side" aria-label="Dinh dưỡng của thực đơn">
          <MealPlanNutritionCard
            nutrition={targets ? dayNutrition(day.items, targets) : null}
            week={{ completedMeals: week.completedMeals, totalMeals: week.planMeals.length, averageCalories: week.averages.calories }}
          />
          <MealPlanSuggestionsCard suggestions={mealPlanSuggestions(profileData?.profile, week.averages, targets?.fat ?? null)} />
        </aside>

        <ShoppingListCard
          items={selected.shoppingItems}
          pendingId={toggleShop.isPending ? toggleShop.variables?.id ?? null : null}
          onToggle={(item) => toggleShop.mutate({ id: item.id, purchased: !item.purchased })}
        />
      </div>
      {toastRegion}
    </div>
  );
}
