import type { Request, Response } from "express";
import { listAdminAuditLogsSchema } from "./admin-audit.schema.js";
import { listAdminAuditLogs } from "./admin-audit.service.js";

// Query đọc lại từ schema để có giá trị mặc định (validate() không ghi đè req.query).
export async function listAdminAuditLogsController(req: Request, res: Response) {
  res.json(await listAdminAuditLogs(listAdminAuditLogsSchema.shape.query.parse(req.query)));
}
