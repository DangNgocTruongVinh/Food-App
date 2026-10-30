import { PackagePlus, Search } from "lucide-react";

type PantryHeaderProps = { search: string; onSearchChange: (value: string) => void; onAdd: () => void };

export default function PantryHeader({ search, onSearchChange, onAdd }: PantryHeaderProps) {
  return <header className="pantry-page-header pantry-v2-header">
    <div className="pantry-title">
      <div><h1 className="max-w-5xl">Kho thực phẩm</h1><p>Quản lý thông minh, dùng đúng lúc và giảm lãng phí.</p></div>
    </div>
    <label className="pantry-global-search">
      <Search />
      <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tìm kiếm thực phẩm..." />
      <kbd>⌘K</kbd>
    </label>
    <button className="button pantry-add-button" onClick={onAdd}><PackagePlus /> Thêm thực phẩm</button>
  </header>;
}
