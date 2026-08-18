import { LoaderCircle, Sprout } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return <div className="state"><LoaderCircle className="spin" /><p>{label}</p></div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="state empty"><span className="state-icon"><Sprout /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
