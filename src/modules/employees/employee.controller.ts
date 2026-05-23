import { Request, Response, NextFunction } from "express";
import { EmployeeService } from "./employee.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type EmployeeParams = {
  id: string;
};

export class EmployeeController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await EmployeeService.createEmployee(
        req.body,
        req.user.role,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "CREATE",
        module: "EMPLOYEE",
        newData: employee,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmployeeService.listEmployees(req.query);

      res.json({
        success: true,
        message: "Employees fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async options(req: Request, res: Response, next: NextFunction) {
    try {
      const employees = await EmployeeService.employeeOptions(req.query);

      res.json({
        success: true,
        data: employees,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const employee = await EmployeeService.getEmployeeById(req.params.id);

      res.json({
        success: true,
        message: "Employee fetched successfully",
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const employee = await EmployeeService.updateEmployee(
        req.params.id,
        req.body,
        req.user.role,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "UPDATE",
        module: "EMPLOYEE",
        newData: employee,
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Employee updated successfully",
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const employee = await EmployeeService.updateStatus(
        req.params.id,
        req.body.status,
        req.user.role,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "UPDATE",
        module: "EMPLOYEE_STATUS",
        newData: {
          employeeId: employee.id,
          status: employee.status,
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Employee status updated successfully",
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRole(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const employee = await EmployeeService.updateRole(
        req.params.id,
        req.body.role,
        req.user.role,
      );

      await AuditLogService.log({
        userId: req.user.id,
        action: "ROLE_CHANGE",
        module: "EMPLOYEE_ROLE",
        newData: {
          employeeId: employee.id,
          role: employee.role,
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: "Employee role updated successfully",
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }
}
