import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { receiptImageUpload } from "../../middleware/image-upload.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  cancelReceiptScanController, commitReceiptScanController, getReceiptScanController, receiptScanStatusController, startReceiptScanController,
  undoReceiptScanController,
} from "./receipt-scan.controller.js";
import { commitReceiptScanSchema, receiptScanIdSchema, receiptStatusSchema, startReceiptScanSchema } from "./receipt-scan.schema.js";

// Mount tại /api/pantry/receipt-scans (trước router /api/pantry).
const router = Router();
router.use(requireAuth);

router.get("/status", validate(receiptStatusSchema), asyncHandler(receiptScanStatusController));
router.post("/", receiptImageUpload, validate(startReceiptScanSchema), asyncHandler(startReceiptScanController));
router.get("/:id", validate(receiptScanIdSchema), asyncHandler(getReceiptScanController));
router.post("/:id/commit", validate(commitReceiptScanSchema), asyncHandler(commitReceiptScanController));
router.post("/:id/cancel", validate(receiptScanIdSchema), asyncHandler(cancelReceiptScanController));
router.post("/:id/undo", validate(receiptScanIdSchema), asyncHandler(undoReceiptScanController));

export default router;
