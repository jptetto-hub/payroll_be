import { Request, Response, NextFunction } from "express";
import { LedgerService } from "./ledger.service";

type EmployeeParams = {
  employeeId: string;
};

type PayrollParams = {
  payrollId: string;
};

export class LedgerController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LedgerService.list(req.query, req.user);

      res.json({
        success: true,
        message: "Ledger entries fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async my(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LedgerService.myLedger(req.user.id, req.query);

      res.json({
        success: true,
        message: "My ledger fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async employeeLedger(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await LedgerService.employeeLedger(
        req.params.employeeId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Employee ledger fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async payrollLedger(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await LedgerService.payrollLedger(
        req.params.payrollId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Payroll ledger fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
