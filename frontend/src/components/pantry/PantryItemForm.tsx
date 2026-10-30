import { X } from "lucide-react";
import type { FormEvent } from "react";
import type { PantryFormValues } from "../../features/pantry/pantry.api";
import type { FoodUnit, StorageLocation } from "../../types";
import type { DateDraftStatus } from "../../utils/date";
import DateInput from "../DateInput";

type PantryItemFormProps = {
  form: PantryFormValues;
  editing: boolean;
  error: string;
  saving: boolean;
  onChange: (form: PantryFormValues) => void;
  onExpiryStatusChange: (status: DateDraftStatus) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
};

export default function PantryItemForm(props: PantryItemFormProps) {
  const { form, editing, error, saving, onChange, onClose } = props;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form
      className="modal" role="dialog" aria-modal="true" aria-labelledby="pantry-modal-title"
      onSubmit={props.onSubmit} onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">{editing ? "Chỉnh sửa nguyên liệu" : "Nguyên liệu mới"}</span>
          <h2 id="pantry-modal-title">{editing ? "Sửa thực phẩm" : "Thêm vào kho"}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X /></button>
      </div>
      <div className="form-grid">
        <label className="span-2">Tên thực phẩm<input
          autoFocus required value={form.name} placeholder="Ví dụ: Ức gà"
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        /></label>
        <label>Nhóm<select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value })}>
          <option>Rau củ</option><option>Thịt & cá</option><option>Trứng & sữa</option><option>Ngũ cốc</option>
          <option>Trái cây</option><option>Gia vị</option><option>Khác</option>
        </select></label>
        <label>Hạn sử dụng<DateInput
          value={form.expiryDate}
          onChange={(expiryDate, status) => { onChange({ ...form, expiryDate }); props.onExpiryStatusChange(status); }}
        /></label>
        <label>Số lượng<input
          required type="number" min="0.1" step="0.1" value={form.quantity}
          onChange={(event) => onChange({ ...form, quantity: Number(event.target.value) })}
        /></label>
        <label>Đơn vị<select value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value as FoodUnit })}>
          <option value="G">gram</option><option value="KG">kg</option><option value="ML">ml</option>
          <option value="L">lít</option><option value="ITEM">cái</option><option value="PACKAGE">gói</option>
        </select></label>
        <label>Tồn kho tối thiểu<input
          required type="number" min="0" step="0.1" value={form.minimumStock}
          onChange={(event) => onChange({ ...form, minimumStock: Number(event.target.value) })}
        /></label>
        <label>Nơi bảo quản<select
          value={form.storageLocation}
          onChange={(event) => onChange({ ...form, storageLocation: event.target.value as StorageLocation })}
        >
          <option value="REFRIGERATOR">Ngăn mát</option><option value="FREEZER">Ngăn đông</option><option value="DRY_STORAGE">Nơi khô ráo</option>
        </select></label>
        <label className="span-2">Ghi chú<textarea
          rows={2} value={form.note} placeholder="Thông tin bổ sung..."
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="button ghost" onClick={onClose}>Hủy</button>
        <button className="button primary" disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm thực phẩm"}</button>
      </div>
    </form>
  </div>;
}
