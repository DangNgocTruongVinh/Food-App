import { ArrowRight, Droplet, Sparkles } from "lucide-react";
import { DASHBOARD_MAX_WATER_GLASSES, dashboardWaterLiters } from "../../features/dashboard/dashboard.logic";

export default function WaterStrip({ glasses, onAddGlass }: { glasses: number; onAddGlass: () => void }) {
  return <section className="overview-v2-water-strip" aria-label="Theo dõi lượng nước">
    <div className="overview-v2-tip">
      <img src="/assets/ai-mascot.png" alt="Nouri" />
      <div>
        <h2>Nouri Tip <Sparkles /></h2>
        <p>Uống đủ 1.5 – 2L nước mỗi ngày giúp cơ thể trao đổi chất tốt hơn và làn da khỏe đẹp.</p>
      </div>
    </div>
    <div className="overview-v2-hydration">
      <div>
        <p>Bạn đã uống <strong>{dashboardWaterLiters(glasses)}L / 2L</strong></p>
        <div className="overview-v2-drops">
          {Array.from({ length: DASHBOARD_MAX_WATER_GLASSES }, (_, index) => <Droplet className={index < glasses ? "filled" : ""} key={index} />)}
        </div>
      </div>
      <button type="button" onClick={onAddGlass} disabled={glasses >= DASHBOARD_MAX_WATER_GLASSES}>Ghi nhận nước <ArrowRight /></button>
    </div>
  </section>;
}
