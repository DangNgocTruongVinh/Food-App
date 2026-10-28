import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getDashboard } from "./dashboard.api";

export const dashboardQueries = {
  overview: () => queryOptions({ queryKey: queryKeys.dashboard, queryFn: getDashboard }),
};
