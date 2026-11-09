import { Plus, ReceiptText, Search } from "lucide-react";
import { Button } from "../ui";

type PantryHeroProps = { search: string; onSearchChange: (value: string) => void; onAdd: () => void; onScan: () => void };

/** Đầu trang Kho (gọn, không ảnh): tìm kiếm, "Quét hóa đơn" (GĐ3c), "Thêm thực phẩm". */
export function PantryHero({ search, onSearchChange, onAdd, onScan }: PantryHeroProps) {
  return (
    <header className="kho-hero">
      <div className="kho-hero__text">
        <h1 className="ui-title">Tủ bếp của bạn</h1>
        <p className="ui-text">Theo dõi số lượng và hạn sử dụng để dùng kịp trước khi hỏng.</p>
      </div>
      <div className="kho-hero__actions">
        <div className="kho-search" role="search">
          <label className="ui-visually-hidden" htmlFor="kho-search">Tìm thực phẩm theo tên hoặc nhóm</label>
          <Search className="kho-search__icon" aria-hidden="true" />
          <input
            id="kho-search"
            className="ui-input kho-search__input"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm thực phẩm"
          />
        </div>
        <Button icon={<ReceiptText />} onClick={onScan}>Quét hóa đơn</Button>
        <Button variant="primary" icon={<Plus />} onClick={onAdd}>Thêm thực phẩm</Button>
      </div>
    </header>
  );
}
