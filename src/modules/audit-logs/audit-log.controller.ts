import { Request, Response, NextFunction } from "express";
import { AuditLogService } from "./audit-log.service";
import { getAuditMeta } from "../../shared/audit/audit-context";

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

  static async listArchive(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuditLogService.listArchive(req.query);

      res.json({
        success: true,
        message: "Archived audit logs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async export(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await AuditLogService.export(req.query);

      await AuditLogService.log({
        userId: req.user.id,
        action: "EXPORT",
        module: "AUDIT_LOG",
        description: "Exported audit logs",
        status: "SUCCESS",
        ...getAuditMeta(req),
      });

      const header = [
        "Timestamp",
        "User",
        "Employee",
        "Module",
        "Action",
        "Description",
        "Status",
        "IP Address",
        "Device",
        "Request ID",
      ];

      const escapeCsv = (value: unknown) => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
      };

      const rows = logs.map((log: any) => [
        log.createdAt?.toISOString?.() ?? log.createdAt,
        log.user
          ? `${log.user.employeeCode} - ${log.user.name}`
          : log.userId ?? "",
        log.employee
          ? `${log.employee.employeeCode} - ${log.employee.name}`
          : log.employeeId ?? "",
        log.module,
        log.action,
        log.description,
        log.status,
        log.ipAddress,
        log.deviceInfo,
        log.requestId,
      ]);

      const csv = [header, ...rows]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-logs-${Date.now()}.csv"`,
      );
      res.send(csv);
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
