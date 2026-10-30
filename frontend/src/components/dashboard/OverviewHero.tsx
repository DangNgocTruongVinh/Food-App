import { Hand, Leaf, Search, SlidersHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { dashboardDateLabel } from "../../features/dashboard/dashboard.logic";

type OverviewHeroProps = {
  greeting: string;
  firstName: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
};

export default function OverviewHero({ greeting, firstName, search, onSearchChange, onSearchSubmit }: OverviewHeroProps) {
  const today = dashboardDateLabel();
  return <section className="overview-v2-hero" aria-labelledby="overview-v2-title">
    <div className="overview-v2-hero-copy">
      <time dateTime={today.iso}>{today.label}</time>
      <h1 id="overview-v2-title">{greeting},<br /><strong>{firstName}!</strong> <Hand aria-hidden="true" /></h1>
      <p>Nouri luôn sẵn sàng đồng hành cùng bạn trên hành trình sống khỏe mỗi ngày.</p>
      <form className="overview-v2-search" onSubmit={onSearchSubmit}>
        <Search aria-hidden="true" />
        <input
          value={search} onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm kiếm món ăn, nguyên liệu, công thức..." aria-label="Tìm kiếm món ăn, nguyên liệu hoặc công thức"
        />
        <button type="submit" aria-label="Mở tìm kiếm nâng cao"><SlidersHorizontal /></button>
      </form>
    </div>

    <div className="overview-v2-hero-visual" aria-hidden="true">
      <Leaf className="overview-v2-hero-leaf leaf-one" />
      <Leaf className="overview-v2-hero-leaf leaf-two" />
      <Leaf className="overview-v2-hero-leaf leaf-three" />
      <span className="overview-v2-lemon-cup"><i /></span>
      <img className="overview-v2-hero-bowl" src="/assets/dashboard-hero-salmon-bowl-v4.png" alt="" />
    </div>
  </section>;
}
