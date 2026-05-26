import { Request, Response, NextFunction } from "express";
import { PayrollService } from "./payroll.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type PayrollParams = {
  id: string;
};

type EmployeeParams = {
  employeeId: string;
};

export class PayrollController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PayrollService.generate(req.body, req.user.role, {
        userId: req.user.id,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: result.carryForward
          ? "Payroll generated successfully with balance carried to the next payroll cycle"
          : "Payroll generated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PayrollService.list(req.query, req.user);

      res.json({
        success: true,
        message: "Payrolls fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.getById(req.params.id);

      res.json({
        success: true,
        message: "Payroll fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listByEmployee(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.listByEmployee(
        req.params.employeeId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Employee payrolls fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.cancelPayroll(
        req.params.id,
        req.user.role,
        req.body.reason,
        req.user.id,
        req.ip,
      );

      res.json({
        success: true,
        message: "Payroll cancelled successfully and related records unlocked",
        data: {
          payroll: result.payroll,
          unlocked: result.unlocked,
          reversedAdvances: result.reversedAdvances,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async recalculate(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.recalculatePayroll(
        req.params.id,
        req.user.role,
        req.body.reason,
        req.user.id,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "PAYROLL_RECALCULATE",
        module: "PAYROLL",
        newData: {
          recalculation: result,
          reason: req.body.reason,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Payroll recalculated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
