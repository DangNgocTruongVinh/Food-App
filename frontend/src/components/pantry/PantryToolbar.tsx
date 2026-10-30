import { Grid2X2, LayoutList, SlidersHorizontal } from "lucide-react";
import type { PantryStatusFilter, PantryView } from "../../features/pantry/pantry.logic";
import type { StorageLocation } from "../../types";

type PantryToolbarProps = {
  total: number;
  categories: Array<[string, number]>;
  category: string;
  status: PantryStatusFilter;
  storage: StorageLocation | "all";
  sortBy: string;
  view: PantryView;
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: PantryStatusFilter) => void;
  onStorageChange: (storage: StorageLocation | "all") => void;
  onSortChange: (sortBy: string) => void;
  onViewChange: (view: PantryView) => void;
};

export default function PantryToolbar(props: PantryToolbarProps) {
  const { total, categories, category, status, storage, sortBy, view } = props;
  return <header className="pantry-inventory-toolbar">
    <div className="pantry-tabs pantry-v2-category-tabs" role="tablist" aria-label="Lọc theo danh mục">
      <button className={category === "all" ? "active" : ""} onClick={() => props.onCategoryChange("all")}>Tất cả <b>{total}</b></button>
      {categories.map(([name, count]) => (
        <button key={name} className={category === name ? "active" : ""} onClick={() => props.onCategoryChange(name)}>{name} <b>{count}</b></button>
      ))}
    </div>
    <div className="pantry-v2-toolbar-actions">
      <details className="pantry-v2-filter-menu">
        <summary><SlidersHorizontal /> Bộ lọc</summary>
        <div className="pantry-filters">
          <label>Tình trạng<select value={status} onChange={(event) => props.onStatusChange(event.target.value as PantryStatusFilter)}>
            <option value="all">Tất cả</option><option value="good">Còn tốt</option>
            <option value="expiring">Sắp hết hạn</option><option value="expired">Đã hết hạn</option>
          </select></label>
          <label>Nơi bảo quản<select value={storage} onChange={(event) => props.onStorageChange(event.target.value as StorageLocation | "all")}>
            <option value="all">Tất cả</option><option value="REFRIGERATOR">Ngăn mát</option>
            <option value="FREEZER">Ngăn đông</option><option value="DRY_STORAGE">Nơi khô ráo</option>
          </select></label>
          <label>Sắp xếp<select value={sortBy} onChange={(event) => props.onSortChange(event.target.value)}>
            <option value="expiry">Hạn sử dụng gần nhất</option><option value="name">Tên A–Z</option>
            <option value="quantity">Số lượng nhiều nhất</option>
          </select></label>
        </div>
      </details>
      <div className="pantry-view-toggle" aria-label="Kiểu hiển thị">
        <button className={view === "list" ? "active" : ""} onClick={() => props.onViewChange("list")} aria-label="Dạng danh sách"><LayoutList /></button>
        <button className={view === "grid" ? "active" : ""} onClick={() => props.onViewChange("grid")} aria-label="Dạng lưới"><Grid2X2 /></button>
      </div>
    </div>
  </header>;
}
