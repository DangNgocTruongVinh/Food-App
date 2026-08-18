import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Flame, PackageOpen, Sparkles, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInCalendarDays } from "date-fns";
import { vi } from "date-fns/locale";
import { api } from "../api/client";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import type { DashboardData } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get<DashboardData>("/dashboard")).data });
  if (isLoading) return <LoadingState />;
  const targets = data?.nutritionTargets;
  return <div className="page">
    <header className="page-header"><div><span className="eyebrow">{format(new Date(), "EEEE, dd 'tháng' M", { locale: vi })}</span><h1>Xin chào, {user?.name?.split(" ").at(-1)}!</h1><p>Hôm nay mình cùng ăn ngon và dùng thực phẩm thông minh nhé.</p></div><Link className="button primary" to="/meal-plans"><Sparkles size={17} /> Tạo thực đơn AI</Link></header>
    <section className="hero-card"><div><span className="pill light"><Sparkles size={14} /> Gợi ý hôm nay</span><h2>{data?.expiringItems.length ? `Có ${data.expiringItems.length} thực phẩm nên dùng sớm` : "Kho thực phẩm đang được kiểm soát tốt"}</h2><p>{data?.expiringItems.length ? `Hãy ưu tiên ${data.expiringItems.slice(0, 2).map((x) => x.name).join(" và ")} trong bữa ăn tiếp theo.` : "Thêm thực phẩm vào kho để AI gợi ý món phù hợp hơn."}</p><Link to="/pantry">Xem kho thực phẩm <ArrowRight size={16} /></Link></div><div className="hero-orbit"><span><Flame /></span><b>{targets?.calories ?? "—"}</b><small>kcal mục tiêu</small></div></section>
    <section className="metric-grid">
      <article className="metric"><span className="metric-icon green"><PackageOpen /></span><div><small>Trong kho</small><strong>{data?.pantryCount ?? 0}</strong><p>loại thực phẩm</p></div></article>
      <article className="metric"><span className="metric-icon orange"><TimerReset /></span><div><small>Sắp hết hạn</small><strong>{data?.expiringItems.length ?? 0}</strong><p>trong 7 ngày</p></div></article>
      <article className="metric"><span className="metric-icon blue"><CalendarCheck /></span><div><small>Tiến độ tuần</small><strong>{data?.activePlan?.completionRate ?? 0}%</strong><p>bữa đã hoàn thành</p></div></article>
      <article className="metric nutrition"><div className="macro"><span>Protein</span><b>{targets?.proteinG ?? 0}g</b></div><div className="macro"><span>Carb</span><b>{targets?.carbsG ?? 0}g</b></div><div className="macro"><span>Chất béo</span><b>{targets?.fatG ?? 0}g</b></div></article>
    </section>
    <section className="two-column"><article className="card"><div className="section-title"><div><span className="eyebrow">Cần ưu tiên</span><h2>Thực phẩm sắp hết hạn</h2></div><Link to="/pantry">Xem tất cả</Link></div>{data?.expiringItems.length ? <div className="expiry-list">{data.expiringItems.map((item) => <div key={item.id}><span className="food-dot">{item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.quantity} {item.unit.toLowerCase()}</small></div><span className="expiry-badge">{Math.max(0, differenceInCalendarDays(new Date(item.expiryDate!), new Date()))} ngày</span></div>)}</div> : <p className="muted">Không có thực phẩm nào hết hạn trong 7 ngày tới.</p>}</article>
      <article className="card plan-progress"><span className="eyebrow">Kế hoạch hiện tại</span><h2>{data?.activePlan?.name ?? "Chưa có thực đơn đang áp dụng"}</h2><p>{data?.activePlan ? "Tiếp tục đánh dấu những bữa ăn bạn đã hoàn thành." : "Tạo thực đơn 7 ngày theo mục tiêu và thực phẩm đang có."}</p><div className="progress"><span style={{ width: `${data?.activePlan?.completionRate ?? 0}%` }} /></div><Link className="button secondary" to="/meal-plans">{data?.activePlan ? "Mở thực đơn" : "Lập thực đơn"}<ArrowRight size={16} /></Link></article></section>
  </div>;
}
