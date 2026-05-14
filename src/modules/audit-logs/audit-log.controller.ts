import { Request, Response, NextFunction } from "express";
import { AuditLogService } from "./audit-log.service";

type AuditLogParams = {
  id: string;
};

type UserParams = {
  userId: string;
};

export class AuditLogController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.list(req.query);

      res.json({
        success: true,
        message: "Audt logs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<AuditLogParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AuditLogService.getById(req.params.id);

      res.json({
        success: true,
        message: "Audit log fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listByUser(
    req: Request<UserParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AuditLogService.listByUser(
        req.params.userId,
        req.query,
      );

      res.json({
        success: true,
        message: "User audit logs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
