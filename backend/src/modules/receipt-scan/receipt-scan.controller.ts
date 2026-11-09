import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { CommitReceiptScanInput, ReceiptScanParams, StartReceiptScanInput } from "./receipt-scan.schema.js";
import { commitReceiptScan, getReceiptScan, getReceiptScanStatus, startReceiptScan, undoReceiptScan } from "./receipt-scan.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function receiptScanStatusController(req: Request, res: Response) {
  res.json(await getReceiptScanStatus(authenticatedUserId(req)));
}

/** 202: đã nhận ảnh, đang đọc nền; xem tiến trình ở GET /:id. */
export async function startReceiptScanController(req: ValidatedRequest<StartReceiptScanInput>, res: Response) {
  const { scan } = await startReceiptScan(authenticatedUserId(req), req.file!.buffer, req.body.provider);
  res.status(202).json(scan);
}

export async function getReceiptScanController(req: ValidatedRequest<unknown, ReceiptScanParams>, res: Response) {
  res.json(await getReceiptScan(authenticatedUserId(req), req.params.id));
}

export async function commitReceiptScanController(req: ValidatedRequest<CommitReceiptScanInput, ReceiptScanParams>, res: Response) {
  res.json(await commitReceiptScan(authenticatedUserId(req), req.params.id, req.body.lines));
}

export async function undoReceiptScanController(req: ValidatedRequest<unknown, ReceiptScanParams>, res: Response) {
  res.json(await undoReceiptScan(authenticatedUserId(req), req.params.id));
}
