import { Droplet } from "lucide-react";
import { DASHBOARD_MAX_WATER_GLASSES, dashboardWaterLiters, formatNumber } from "../../features/dashboard/dashboard.logic";
import { Button } from "../ui";

/** Lượng nước (khối phụ, một dải gọn cuối trang): giữ chức năng cũ, chỉ ghi nhận trong lần xem này (lưu DB ở GĐ5). */
export function WaterTracker({ glasses, onAddGlass }: { glasses: number; onAddGlass: () => void }) {
  const liters = formatNumber(dashboardWaterLiters(glasses));
  return (
    <section className="dash-water" aria-labelledby="dash-water-title">
      <div className="dash-water__text">
        <h2 id="dash-water-title" className="dash-water__title">Nước hôm nay</h2>
        <p className="dash-water__amount"><strong>{liters} / 2 lít</strong> ({glasses}/{DASHBOARD_MAX_WATER_GLASSES} ly 250 ml)</p>
        <p className="dash-water__hint">Chỉ ghi nhận trong lần xem này, chưa lưu vào tài khoản.</p>
      </div>
      <div className="dash-water__glasses" aria-hidden="true">
        {Array.from({ length: DASHBOARD_MAX_WATER_GLASSES }, (_, index) => (
          <Droplet key={index} className={index < glasses ? "is-filled" : ""} fill={index < glasses ? "currentColor" : "none"} />
        ))}
      </div>
      <Button onClick={onAddGlass} disabled={glasses >= DASHBOARD_MAX_WATER_GLASSES}>Thêm 1 ly nước</Button>
    </section>
  );
}
