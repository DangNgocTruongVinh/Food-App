import { useState } from "react";
import { REMOVAL_REASON_OPTIONS, suggestedRemovalReason } from "../../features/pantry/pantry.logic";
import type { PantryItem, PantryRemovalReason } from "../../types";
import { Button, ChoiceGroup, Dialog } from "../ui";

type RemovePantryItemDialogProps = {
  item: PantryItem;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: PantryRemovalReason) => void;
};

/** Xóa khỏi kho kèm lý do (Báo cáo lãng phí): đã dùng hết / bỏ đi / nhập nhầm. Phải chọn lý do mới xóa được. */
export function RemovePantryItemDialog({ item, busy, onCancel, onConfirm }: RemovePantryItemDialogProps) {
  const [reason, setReason] = useState<PantryRemovalReason | "">(() => suggestedRemovalReason(item));
  return (
    <Dialog
      title={`Xóa “${item.name}” khỏi kho?`}
      description="Thực phẩm sẽ không còn trong danh sách và Nouri thôi nhắc hạn của nó. Lý do giúp trang Báo cáo tính lãng phí; “Nhập nhầm” không được tính."
      onClose={onCancel}
    >
      <ChoiceGroup
        legend="Lý do" name="pantry-remove-reason" options={REMOVAL_REASON_OPTIONS} value={reason}
        onChange={(value) => setReason(value as PantryRemovalReason)}
        hint={reason ? undefined : "Chọn một lý do để xóa."}
      />
      <div className="ui-dialog__actions">
        <Button onClick={onCancel}>Hủy</Button>
        <Button variant="danger" busy={busy} disabled={!reason} onClick={() => reason && onConfirm(reason)}>Xóa thực phẩm</Button>
      </div>
    </Dialog>
  );
}
