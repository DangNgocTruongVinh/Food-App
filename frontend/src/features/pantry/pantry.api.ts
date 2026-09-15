import { api } from "../../api/client";
import type { FoodUnit, PantryInput, PantryItem, PantryUpdateInput, StorageLocation } from "../../types";

export type PantryFormValues = {
  name: string;
  category: string;
  quantity: number;
  unit: FoodUnit;
  storageLocation: StorageLocation;
  expiryDate: string;
  minimumStock: number;
  note: string;
};

export function toCreatePantryInput(form: PantryFormValues): PantryInput {
  return {
    ...form,
    quantity: Number(form.quantity),
    expiryDate: form.expiryDate || null,
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

export async function deletePantryItem(id: string) {
  await api.delete(`/pantry/${id}`);
}
