import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, password } = req.body;

      const result = await AuthService.login(phone, password);
      await AuditLogService.log({
        userId: result.employee.id,
        employeeId: result.employee.id,
        action: "LOGIN",
        module: "AUTH",
        entityId: result.employee.id,
        description: `${result.employee.name} logged in`,
        status: "SUCCESS",
        newData: {
          employeeId: result.employee.id,
          phone: result.employee.phone,
          role: result.employee.role,
        },
      });
      res.json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.user.id;

      const result = await AuthService.getMe(employeeId);

      res.json({
        success: true,
        message: "Profile fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await AuditLogService.log({
        userId: req.user.id,
        employeeId: req.user.id,
        action: "LOGOUT" as any,
        module: "AUTH",
        entityId: req.user.id,
        description: "User logged out",
        status: "SUCCESS",
      });

      res.json({
        success: true,
        message: "Logout logged successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}
