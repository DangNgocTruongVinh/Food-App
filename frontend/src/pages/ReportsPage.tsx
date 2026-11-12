import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../api/query-keys";
import { NutritionReport, type ReportWeek } from "../components/reports/NutritionReport";
import { WasteReport } from "../components/reports/WasteReport";
import { getNutritionReport, getWasteReport } from "../features/reports/reports.api";

/** /reports: Báo cáo lãng phí thực phẩm (4/8 tuần) và dinh dưỡng tuần (tuần này/tuần trước). */
export default function ReportsPage() {
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const [week, setWeek] = useState<ReportWeek>("current");
  const waste = useQuery({ queryKey: queryKeys.reports.waste(weeks), queryFn: () => getWasteReport(weeks), staleTime: 30_000 });
  const nutrition = useQuery({ queryKey: queryKeys.reports.nutrition(week), queryFn: () => getNutritionReport(week), staleTime: 30_000 });

  return (
    <div className="bc-view">
      <header className="bc-hero">
        <h1 className="ui-title">Báo cáo</h1>
        <p className="ui-text">Theo dõi thực phẩm bị bỏ đi, tiền lãng phí và dinh dưỡng các bữa đã ăn so với mục tiêu của bạn.</p>
      </header>
      <WasteReport
        data={waste.data} weeks={weeks} isLoading={waste.isLoading} isError={waste.isError} isFetching={waste.isFetching}
        onRetry={() => void waste.refetch()} onWeeksChange={setWeeks}
      />
      <NutritionReport
        data={nutrition.data} week={week} isLoading={nutrition.isLoading} isError={nutrition.isError} isFetching={nutrition.isFetching}
        onRetry={() => void nutrition.refetch()} onWeekChange={setWeek}
      />
    </div>
  );
}
