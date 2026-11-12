import { api } from "../../api/client";
import type {
  FoodUnit, PantryInput, PantryItem, PantryRemovalReason, PantryTransactionPage, PantryTransactionSource, PantryUpdateInput, StorageLocation,
} from "../../types";

export type PantryFormValues = {
  name: string;
  category: string;
  quantity: number;
  unit: FoodUnit;
  storageLocation: StorageLocation;
  expiryDate: string;
  minimumStock: number;
  note: string;
  /** Đơn giá (đ / 1 đơn vị), tùy chọn; NaN = để trống. */
  unitPrice: number;
};

export function toCreatePantryInput(form: PantryFormValues): PantryInput {
  return {
    ...form,
    quantity: Number(form.quantity),
    expiryDate: form.expiryDate || null,
    unitPrice: Number.isFinite(form.unitPrice) ? form.unitPrice : null,
  };
}

export function toPantryFormValues(item: PantryItem): PantryFormValues {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    storageLocation: item.storageLocation,
    expiryDate: item.expiryDate?.slice(0, 10) ?? "",
    minimumStock: item.minimumStock,
    note: item.note ?? "",
    unitPrice: item.unitPrice ?? Number.NaN,
  };
}

export async function listPantryItems() {
  return (await api.get<PantryItem[]>("/pantry")).data;
}

export async function createPantryItem(input: PantryInput) {
  return (await api.post<PantryItem>("/pantry", input)).data;
}

export async function updatePantryItem(id: string, input: PantryUpdateInput) {
  return (await api.put<PantryItem>(`/pantry/${id}`, input)).data;
}

export async function deletePantryItem({ id, reason }: { id: string; reason: PantryRemovalReason }) {
  await api.delete(`/pantry/${id}`, { params: { reason } });
}

export type PantryTransactionFilters = { source?: PantryTransactionSource; pantryItemId?: string; page: number; pageSize: number };

/** Lịch sử kho của người đang đăng nhập, mới nhất trước; lọc theo nguồn và/hoặc một thực phẩm. */
export async function listPantryTransactions({ source, pantryItemId, page, pageSize }: PantryTransactionFilters) {
  const params = { page, pageSize, ...(source ? { source } : {}), ...(pantryItemId ? { pantryItemId } : {}) };
  return (await api.get<PantryTransactionPage>("/pantry/transactions", { params })).data;
}
