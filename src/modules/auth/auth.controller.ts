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
        action: "LOGIN",
        module: "AUTH",
        newData: {
          employeeId: result.employee.id,
          phone: result.employee.phone,
          role: result.employee.role,
        },
        ipAddress: req.ip,
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
}
