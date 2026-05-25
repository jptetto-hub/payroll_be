import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { AuthSessionService } from "./auth-session.service";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

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
      AuthSessionService.setCookie(res, result.token);

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
      await AuthSessionService.revoke(req.authSession?.id);
      AuthSessionService.clearCookie(res);

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
      } catch (auditError) {
        logger.warn(
          { error: auditError, employeeId: req.user.id },
          "Logout completed, but audit logging failed",
        );
      }

      res.json({
        success: true,
        message: "Logout logged successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async activity(req: Request, res: Response, next: NextFunction) {
    try {
      const session = req.authSession;

      if (
        !session ||
        !(await AuthSessionService.renew(session.id, req.user.id))
      ) {
        AuthSessionService.clearCookie(res);
        throw new Error("Unauthorized: session expired due to inactivity");
      }

      AuthSessionService.setCookie(res, session.token);

      res.json({
        success: true,
        message: "Session activity registered",
        data: {
          idleTimeoutSeconds: env.authIdleTimeoutSeconds,
          remainingSeconds: env.authIdleTimeoutSeconds,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async sessionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const session = req.authSession;

      if (!session) {
        throw new Error("Unauthorized: session missing");
      }

      const remainingSeconds = await AuthSessionService.remainingSeconds(
        session.id,
      );

      if (remainingSeconds <= 0) {
        AuthSessionService.clearCookie(res);
        throw new Error("Unauthorized: session expired due to inactivity");
      }

      res.json({
        success: true,
        message: "Session active",
        data: {
          idleTimeoutSeconds: env.authIdleTimeoutSeconds,
          remainingSeconds,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
