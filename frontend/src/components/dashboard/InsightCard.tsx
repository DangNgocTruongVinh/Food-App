import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { dashboardInsightMessage } from "../../features/dashboard/dashboard.logic";

export default function InsightCard({ title, hasExpiringItems }: { title: string; hasExpiringItems: boolean }) {
  return <section className="overview-v2-insight" aria-labelledby="overview-v2-insight-title">
    <div className="overview-v2-insight-heading"><h2 id="overview-v2-insight-title">Nouri Insight</h2><Sparkles /></div>
    <img className="overview-v2-insight-ingredients" src="/assets/dashboard-insight-ingredients-v4.png" alt="" />
    <div className="overview-v2-insight-copy">
      <span>Gợi ý thông minh cho bạn</span>
      <h3>{title}</h3>
      <p>{dashboardInsightMessage(hasExpiringItems)}</p>
      <Link to="/assistant">Xem gợi ý món <ArrowRight /></Link>
    </div>
    <div className="overview-v2-insight-dish"><img src="/assets/dashboard-insight-chicken-bowl-v4.jpg" alt="Bowl gà quinoa Nouri đề xuất" /></div>
  </section>;
}
