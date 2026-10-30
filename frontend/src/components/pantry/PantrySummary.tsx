import { CalendarX2, Clock3, PackageOpen, Snowflake } from "lucide-react";
import type { PantryCounts } from "../../features/pantry/pantry.logic";

export default function PantrySummary({ counts }: { counts: PantryCounts }) {
  return <section className="pantry-v2-summary" aria-label="Tổng quan kho thực phẩm">
    <div className="pantry-v2-hero-media">
      <img src="/assets/pantry-hero.png" alt="Tủ lạnh được sắp xếp gọn gàng với thực phẩm tươi" />
    </div>
    <div className="pantry-hero-stats">
      <article className="pantry-v2-metric">
        <span className="pantry-stat-icon total"><PackageOpen /></span>
        <div><strong>{counts.total}</strong><b>Tổng thực phẩm</b><small>Trong kho</small></div>
      </article>
      <article className="pantry-v2-metric">
        <span className="pantry-stat-icon soon"><Clock3 /></span>
        <div><strong>{counts.expiring}</strong><b>Sắp hết hạn</b><small>Trong 3 ngày</small></div>
      </article>
      <article className="pantry-v2-metric">
        <span className="pantry-stat-icon expired"><CalendarX2 /></span>
        <div><strong>{counts.expired}</strong><b>Đã hết hạn</b><small>Cần xử lý</small></div>
      </article>
      <article className="pantry-v2-metric">
        <span className="pantry-stat-icon cold"><Snowflake /></span>
        <div><strong>{counts.cold}</strong><b>Bảo quản lạnh</b><small>Ngăn mát và đông</small></div>
      </article>
    </div>
  </section>;
}
