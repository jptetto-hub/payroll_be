import { Request, Response, NextFunction } from "express";
import { SalaryHistoryService } from "./salary-history.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type SalaryHistoryParams = {
  id: string;
};

type EmployeeParams = {
  employeeId: string;
};

export class SalaryHistoryController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const salaryHistory = await SalaryHistoryService.createSalaryHistory(
        req.body,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "CREATE",
        module: "SALARY_HISTORY",
        newData: salaryHistory,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: "Salary history added successfully",
        data: salaryHistory,
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
      const result = await SalaryHistoryService.listSalaryHistory(
        req.params.employeeId,
        req.user.role,
        req.user.id,
        req.query,
      );

      res.json({
        success: true,
        message: "Salary history fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request<SalaryHistoryParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SalaryHistoryService.updateSalaryHistory(
        req.params.id,
        req.body,
        req.user.role,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "UPDATE",
        module: "SALARY_HISTORY",
        newData: {
          ...result,
          correctionReason: req.body.correctionReason,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Salary history updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request<SalaryHistoryParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SalaryHistoryService.deleteSalaryHistory(
        req.params.id,
        req.user.role,
        req.body?.reason,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "DELETE",
        module: "SALARY_HISTORY",
        newData: {
          deletedRecord: result,
          reason: req.body.reason,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Salary history deleted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async current(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SalaryHistoryService.getCurrentSalary(
        req.params.employeeId,
        req.user.role,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Current salary fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async resolve(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SalaryHistoryService.resolveSalary(
        req.params.employeeId,
        req.query.date as string,
        req.user.role,
        req.user.id,
      );

      res.json({
        success: true,
        message: "Salary resolved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
