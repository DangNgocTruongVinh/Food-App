import { Grid2X2, List } from "lucide-react";
import type { PantryStatusFilter, PantryView } from "../../features/pantry/pantry.logic";
import type { StorageLocation } from "../../types";
import { Chip, IconButton } from "../ui";

type PantryCategoryChipsProps = {
  total: number;
  categories: Array<[string, number]>;
  category: string;
  onChange: (category: string) => void;
};

/** Chip nhóm kèm số thực phẩm thật của từng nhóm. */
export function PantryCategoryChips({ total, categories, category, onChange }: PantryCategoryChipsProps) {
  return (
    <div className="kho-chips" role="group" aria-label="Lọc theo nhóm thực phẩm">
      <Chip selected={category === "all"} count={total} onClick={() => onChange("all")}>Tất cả</Chip>
      {categories.map(([name, count]) => (
        <Chip key={name} selected={category === name} count={count} onClick={() => onChange(name)}>{name}</Chip>
      ))}
    </div>
  );
}

type PantryToolbarProps = {
  status: PantryStatusFilter;
  storage: StorageLocation | "all";
  sortBy: string;
  view: PantryView;
  onStatusChange: (status: PantryStatusFilter) => void;
  onStorageChange: (storage: StorageLocation | "all") => void;
  onSortChange: (sortBy: string) => void;
  onViewChange: (view: PantryView) => void;
};

/** Thanh lọc trên bảng: tình trạng, nơi bảo quản, sắp xếp, kiểu hiển thị. */
export function PantryToolbar(props: PantryToolbarProps) {
  const { status, storage, sortBy, view } = props;
  return (
    <div className="kho-toolbar">
      <div className="kho-toolbar__field">
        <label className="kho-toolbar__label" htmlFor="kho-status">Tình trạng</label>
        <select
          id="kho-status"
          className="ui-input kho-toolbar__select"
          value={status}
          onChange={(event) => props.onStatusChange(event.target.value as PantryStatusFilter)}
        >
          <option value="all">Tất cả</option>
          <option value="good">Còn tốt</option>
          <option value="expiring">Sắp hết hạn</option>
          <option value="expired">Đã hết hạn</option>
          <option value="depleted">Đã dùng hết</option>
        </select>
      </div>
      <div className="kho-toolbar__field">
        <label className="kho-toolbar__label" htmlFor="kho-storage">Nơi bảo quản</label>
        <select
          id="kho-storage"
          className="ui-input kho-toolbar__select"
          value={storage}
          onChange={(event) => props.onStorageChange(event.target.value as StorageLocation | "all")}
        >
          <option value="all">Tất cả</option>
          <option value="REFRIGERATOR">Ngăn mát</option>
          <option value="FREEZER">Ngăn đông</option>
          <option value="DRY_STORAGE">Nơi khô ráo</option>
        </select>
      </div>
      <div className="kho-toolbar__field">
        <label className="kho-toolbar__label" htmlFor="kho-sort">Sắp xếp</label>
        <select id="kho-sort" className="ui-input kho-toolbar__select" value={sortBy} onChange={(event) => props.onSortChange(event.target.value)}>
          <option value="expiry">Hạn gần nhất</option>
          <option value="name">Tên A–Z</option>
          <option value="quantity">Số lượng nhiều nhất</option>
        </select>
      </div>
      <div className="kho-toolbar__view" role="group" aria-label="Kiểu hiển thị">
        <IconButton label="Dạng danh sách" icon={<List />} quiet pressed={view === "list"} onClick={() => props.onViewChange("list")} />
        <IconButton label="Dạng lưới" icon={<Grid2X2 />} quiet pressed={view === "grid"} onClick={() => props.onViewChange("grid")} />
      </div>
    </div>
  );
}
