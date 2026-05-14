import { Request, Response, NextFunction } from "express";
import { PayslipService } from "./payslip.service";

type PayslipParams = {
  id: string;
};

type PayrollParams = {
  payrollId: string;
};

type EmployeeParams = {
  employeeId: string;
};

export class PayslipController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PayslipService.list(req.query, req.user);

      res.json({
        success: true,
        message: "Payslips fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async my(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PayslipService.myPayslips(req.user.id, req.query);

      res.json({
        success: true,
        message: "My payslips fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<PayslipParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayslipService.getById(req.params.id, req.user);

      res.json({
        success: true,
        message: "Payslip fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getByPayroll(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayslipService.getByPayroll(
        req.params.payrollId,
        req.user.role,
      );

      res.json({
        success: true,
        message: "Payroll payslip fetched successfully",
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
      const result = await PayslipService.listByEmployee(
        req.params.employeeId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Employee payslips fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
