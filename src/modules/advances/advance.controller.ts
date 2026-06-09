import { Request, Response, NextFunction } from "express";
import { AdvanceService } from "./advance.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type AdvanceParams = {
  id: string;
};

type ManualDeductionParams = {
  id: string;
};

type EmployeeParams = {
  employeeId: string;
};

type CycleQuery = {
  cycleStartDate: string;
  cycleEndDate: string;
};

type ManualDeductionQuery = {
  periodStart: string;
  periodEnd: string;
};

export class AdvanceController {
  static async deductionPreview(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.deductionPreview(
        req.body,
        req.user.role,
      );

      res.json({
        success: true,
        message: "Advance deduction preview generated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdvanceService.createAdvance(
        req.body,
        req.user.role,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "CREATE",
        module: "ADVANCE",
        newData: result,
        ipAddress: req.ip,
      });
      res.status(201).json({
        success: true,
        message: "Advance created successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdvanceService.listAdvances(
        req.query,
        req.user,
      );

      res.json({
        success: true,
        message: "Advances fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async my(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdvanceService.myAdvances(req.user.id, req.query);

      res.json({
        success: true,
        message: "My advances fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<AdvanceParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.getAdvanceById(
        req.params.id,
        req.user,
      );

      res.json({
        success: true,
        message: "Advance fetched successfully",
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
      const result = await AdvanceService.listByEmployee(
        req.params.employeeId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Employee advances fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listByCycle(
    req: Request<EmployeeParams, unknown, unknown, CycleQuery>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.listByCycle(
        req.params.employeeId,
        req.query.cycleStartDate,
        req.query.cycleEndDate,
        req.user.role,
      );

      res.json({
        success: true,
        message: "Cycle advances fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getManualDeduction(
    req: Request<EmployeeParams, unknown, unknown, ManualDeductionQuery>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.getManualDeduction(
        req.params.employeeId,
        req.query.periodStart,
        req.query.periodEnd,
        req.user.role,
      );

      res.json({
        success: true,
        message: "Manual advance deduction fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async upsertManualDeduction(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.upsertManualDeduction(
        req.body,
        req.user.role,
        req.user.id,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "UPDATE",
        module: "ADVANCE",
        newData: result,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Manual advance deduction saved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteManualDeduction(
    req: Request<ManualDeductionParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.deleteManualDeduction(
        req.params.id,
        req.user.role,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "DELETE",
        module: "ADVANCE",
        newData: {
          deletedManualDeduction: result,
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Manual advance deduction deleted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request<AdvanceParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.updateAdvance(
        req.params.id,
        req.body,
        req.user.role,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "UPDATE",
        module: "ADVANCE",
        newData: {
          advance: result,
          reason: req.body.reason,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Advance updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request<AdvanceParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AdvanceService.deleteAdvance(
        req.params.id,
        req.user.role,
        req.body.reason,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "DELETE",
        module: "ADVANCE",
        newData: {
          deletedAdvance: result,
          reason: req.body.reason,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Advance deleted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
