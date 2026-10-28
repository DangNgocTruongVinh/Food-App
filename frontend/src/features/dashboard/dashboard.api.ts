import { api } from "../../api/client";
import type { DashboardData } from "../../types";

export async function getDashboard() {
  return (await api.get<DashboardData>("/dashboard")).data;
}
