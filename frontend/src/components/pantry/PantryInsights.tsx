import { ChefHat } from "lucide-react";
import { Link } from "react-router-dom";
import { storageTip, type PantryCounts } from "../../features/pantry/pantry.logic";
import type { PantryItem } from "../../types";
import CategoryIcon from "./CategoryIcon";

type PantryInsightsProps = { counts: PantryCounts; tipItems: PantryItem[]; savings: number };

export default function PantryInsights({ counts, tipItems, savings }: PantryInsightsProps) {
  return <aside className="pantry-insights pantry-v2-insights">
    <section className="pantry-v2-recipe-card pantry-v2-stack-card">
      <div>
        <h2>Nấu gì từ kho? <span className="pantry-v2-inline-food"><img src="/assets/recipe-vegan-bowl.jpg" alt="" /></span></h2>
        <p>Nouri gợi ý món ăn dựa trên nguyên liệu bạn đang có, ưu tiên thực phẩm sắp hết hạn.</p>
        <Link to="/assistant"><ChefHat /> Xem gợi ý món ăn</Link>
      </div>
      <img src="/assets/recipe-vegan-bowl.jpg" alt="Bowl rau củ Nouri gợi ý" />
    </section>
    <section className="pantry-v2-tips pantry-v2-stack-card">
      <header><h2>Mẹo bảo quản cho bạn</h2><Link to="/assistant">Xem tất cả</Link></header>
      <div className="pantry-v2-tip-list">{tipItems.length ? tipItems.map((item) => <article key={item.id}>
        <span><CategoryIcon category={item.category} /></span>
        <div><b>{item.name} của bạn</b><small>{storageTip(item)}</small></div>
      </article>) : <p>Thêm thực phẩm để nhận mẹo bảo quản phù hợp.</p>}</div>
    </section>
    <section className="pantry-v2-savings pantry-v2-stack-card">
      <h2>Nouri giúp bạn tiết kiệm hơn mỗi ngày</h2>
      <div>
        <article><strong>{new Intl.NumberFormat("vi-VN").format(savings)}đ</strong><small>Tiết kiệm ước tính</small></article>
        <article><strong>{counts.good + counts.expiring}</strong><small>Thực phẩm dùng đúng hạn</small></article>
        <article><strong>{counts.total}</strong><small>Nguyên liệu được theo dõi</small></article>
      </div>
    </section>
  </aside>;
}
