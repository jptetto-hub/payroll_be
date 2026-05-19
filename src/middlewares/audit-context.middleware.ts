import { NextFunction, Request, Response } from "express";
import {
  getAuditMeta,
  runWithAuditContext,
} from "../shared/audit/audit-context";

export function auditContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const meta = getAuditMeta(req);

  if (meta.requestId) {
    res.setHeader("X-Request-Id", meta.requestId);
  }

  runWithAuditContext(meta, next);
}
