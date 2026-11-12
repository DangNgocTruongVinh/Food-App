import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiError } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import type { ReceiptScan, ReceiptScanMode } from "../../types";
import { shrinkReceiptImage } from "./receipt-image";
import { cancelReceiptScan, getReceiptScan, uploadReceipt } from "./receipt-scan.api";
import { receiptFileError, uploadErrorMessage } from "./receipt-scan.logic";

// Điều khiển một lần quét: chọn ảnh → thu nhỏ → tải lên (có %) → hỏi trạng thái mỗi giây tới khi đọc xong → màn duyệt.
// "Hủy" khi đang tải: dừng tải; khi đang đọc: báo server hủy (lần quét vẫn tính lượt).

export type ReceiptScanState =
  | { kind: "pick" }
  | { kind: "uploading"; fraction: number | null }
  | { kind: "processing"; id: string }
  | { kind: "review"; scan: ReceiptScan }
  | { kind: "error"; message: string; quota: boolean };

const POLL_MS = 1000;
const ACTIVE_PHASES = ["queued", "reading", "parsing"];

export function useReceiptScan() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReceiptScanState>({ kind: "pick" });
  const abortRef = useRef<AbortController | null>(null);
  const processingId = state.kind === "processing" ? state.id : null;

  const poll = useQuery({
    queryKey: queryKeys.receiptScans.detail(processingId ?? ""),
    queryFn: () => getReceiptScan(processingId!),
    enabled: processingId !== null,
    refetchInterval: POLL_MS,
    gcTime: 0,
  });

  useEffect(() => {
    const scan = poll.data;
    if (!processingId || !scan || scan.id !== processingId || ACTIVE_PHASES.includes(scan.phase)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.status });
    if (scan.phase === "ready" && scan.draft) setState({ kind: "review", scan });
    else setState({ kind: "error", message: scan.error ?? "Không đọc được ảnh này. Hãy chụp lại rõ hơn.", quota: false });
  }, [poll.data, processingId, queryClient]);

  useEffect(() => {
    if (processingId && poll.isError) setState({ kind: "error", message: `Mất kết nối khi đọc hóa đơn: ${getApiError(poll.error)}`, quota: false });
  }, [poll.error, poll.isError, processingId]);

  const start = useCallback(async (file: File, mode: ReceiptScanMode) => {
    setState({ kind: "uploading", fraction: null });
    let image: Blob;
    try {
      image = await shrinkReceiptImage(file);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Không đọc được ảnh.", quota: false });
      return;
    }
    const fileError = receiptFileError(image);
    if (fileError) {
      setState({ kind: "error", message: fileError, quota: false });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const created = await uploadReceipt(image, mode, {
        signal: controller.signal,
        onProgress: (fraction) => setState({ kind: "uploading", fraction }),
      });
      setState({ kind: "processing", id: created.id });
    } catch (error) {
      if (axios.isCancel(error)) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      setState({ kind: "error", message: uploadErrorMessage(status, getApiError(error)), quota: status === 429 });
      void queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.status });
    } finally {
      abortRef.current = null;
    }
  }, [queryClient]);

  /** Dừng việc đang chạy (tải lên hoặc đọc) và quay về chọn ảnh. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (processingId) void cancelReceiptScan(processingId).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.status });
    setState({ kind: "pick" });
  }, [processingId, queryClient]);

  const reset = useCallback(() => setState({ kind: "pick" }), []);

  /** Trạng thái mới nhất của lần quét đang đọc (phase, % đọc) để vẽ tiến trình. */
  const current = processingId && poll.data?.id === processingId ? poll.data : null;
  return { state, current, start, cancel, reset };
}
