import type { ShoppingPurchaseResult } from "../../types";
import { formatDisplayDate } from "../../utils/date";
import { formatAmount } from "./consumption.logic";

// Tick "Đã mua" → thêm vào kho (GĐ3b lượt 6): câu nhắc sau khi tick / bỏ tick ở danh sách đi chợ.

export type ShoppingNotice = { kind: "added" | "restored" | "error"; message: string; pantryItemId: string | null };

const ACTION_NOTE = {
  MERGED: "cộng vào thực phẩm sẵn có",
  REUSED: "dùng lại thực phẩm đã dùng hết",
  CREATED: "thực phẩm mới",
} as const;

/** "Đã thêm 300 g Đậu hũ vào kho (thực phẩm mới, hạn ước tính 06/11/2026)." Có thực phẩm thì kèm id để mở "Sửa". */
export function purchaseNotice(result: ShoppingPurchaseResult): ShoppingNotice {
  if (result.alreadyPurchased) return { kind: "added", message: `${result.name} đã được đánh dấu đã mua trước đó, kho không đổi.`, pantryItemId: null };
  const pantry = result.pantry;
  if (!pantry) return { kind: "added", message: `Đã đánh dấu đã mua: ${result.name}.`, pantryItemId: null };
  const details: string[] = [ACTION_NOTE[pantry.action]];
  if (pantry.action === "MERGED") details.push(`nay còn ${formatAmount(pantry.quantityAfter, pantry.unit)}`);
  else if (pantry.expiryDate) details.push(`${pantry.expiryEstimated ? "hạn ước tính" : "hạn"} ${formatDisplayDate(pantry.expiryDate)}`);
  return {
    kind: "added",
    message: `Đã thêm ${formatAmount(pantry.quantity, pantry.unit)} ${pantry.name} vào kho (${details.join(", ")}).`,
    pantryItemId: pantry.pantryItemId,
  };
}

const SKIP_REASON = {
  DELETED: "thực phẩm đã bị xóa khỏi kho",
  UNIT_MISMATCH: "thực phẩm đã đổi sang đơn vị không quy đổi được",
  CHANGED: "kho vừa thay đổi",
  INSUFFICIENT: "kho không còn đủ, có thể đã dùng một phần",
} as const;

/** Bỏ tick: những gì đã xóa/trừ lại khỏi kho và những gì không trừ lại được. */
export function unpurchaseNotice(result: ShoppingPurchaseResult): ShoppingNotice {
  const restored = result.restoration?.restored ?? [];
  const skipped = result.restoration?.skipped ?? [];
  const parts = [`Đã bỏ đánh dấu đã mua: ${result.name}.`];
  const removed = restored.filter((entry) => entry.removed).map((entry) => `${formatAmount(entry.quantity, entry.unit)} ${entry.name}`);
  const taken = restored.filter((entry) => !entry.removed).map((entry) => `${formatAmount(entry.quantity, entry.unit)} ${entry.name}`);
  if (removed.length) parts.push(`Đã xóa ${removed.join(", ")} khỏi kho (thực phẩm do lần mua này thêm vào).`);
  if (taken.length) parts.push(`Đã trừ lại ${taken.join(", ")} khỏi kho.`);
  if (skipped.length) {
    parts.push(`Không trừ lại được ${skipped.map((entry) => `${formatAmount(entry.quantity, entry.unit)} ${entry.itemName} (${SKIP_REASON[entry.reason]})`).join(", ")}.`);
  }
  if (!restored.length && !skipped.length) parts.push("Kho không đổi.");
  return { kind: "restored", message: parts.join(" "), pantryItemId: null };
}
