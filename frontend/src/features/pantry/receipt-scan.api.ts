import { api } from "../../api/client";
import type {
  ReceiptCommitLine, ReceiptCommitResult, ReceiptProviderId, ReceiptScan, ReceiptScanMode, ReceiptScanStatus, ReceiptUndoResult,
} from "../../types";

// Quét hóa đơn (GĐ3c): /api/pantry/receipt-scans. Ảnh gửi multipart, đọc ở nền; GET /:id để theo dõi tiến trình.

export async function getReceiptScanStatus() {
  return (await api.get<ReceiptScanStatus>("/pantry/receipt-scans/status")).data;
}

export async function uploadReceipt(
  image: Blob, mode: ReceiptScanMode, options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
) {
  const form = new FormData();
  form.append("image", image, "receipt.jpg");
  form.append("provider", mode);
  const response = await api.post<{ id: string; provider: ReceiptProviderId; phase: "queued" }>("/pantry/receipt-scans", form, {
    signal: options.signal,
    onUploadProgress: (event) => {
      if (event.total) options.onProgress?.(event.loaded / event.total);
    },
  });
  return response.data;
}

export async function getReceiptScan(id: string) {
  return (await api.get<ReceiptScan>(`/pantry/receipt-scans/${id}`)).data;
}

export async function cancelReceiptScan(id: string) {
  await api.post(`/pantry/receipt-scans/${id}/cancel`);
}

export async function commitReceiptScan(id: string, lines: ReceiptCommitLine[]) {
  return (await api.post<ReceiptCommitResult>(`/pantry/receipt-scans/${id}/commit`, { lines })).data;
}

export async function undoReceiptScan(id: string) {
  return (await api.post<ReceiptUndoResult>(`/pantry/receipt-scans/${id}/undo`)).data;
}
