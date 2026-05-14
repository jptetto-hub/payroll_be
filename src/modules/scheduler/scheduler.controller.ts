import { Request, Response, NextFunction } from "express";
import { SchedulerService } from "./scheduler.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

export class SchedulerController {
  static async runPayroll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SchedulerService.runPayrollScheduler("MANUAL");

      res.json({
        success: true,
        message: "Payroll scheduler executed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async runs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SchedulerService.listRuns(req.query);
      await AuditLogService.log({
        userId: req.user.id,
        action: "PAYROLL_GENERATE",
        module: "SCHEDULER",
        newData: {
          triggeredBy: "MANUAL",
          result,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Scheduler runs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
