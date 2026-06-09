"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const auth_session_service_1 = require("./auth-session.service");
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
class AuthController {
    static async login(req, res, next) {
        try {
            const { phone, password } = req.body;
            const result = await auth_service_1.AuthService.login(phone, password);
            await audit_log_service_1.AuditLogService.log({
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
            auth_session_service_1.AuthSessionService.setCookie(res, result.token);
            res.json({
                success: true,
                message: "Login successful",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async me(req, res, next) {
        try {
            const employeeId = req.user.id;
            const result = await auth_service_1.AuthService.getMe(employeeId);
            res.json({
                success: true,
                message: "Profile fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            await auth_session_service_1.AuthSessionService.revoke(req.authSession?.id);
            auth_session_service_1.AuthSessionService.clearCookie(res);
            try {
                await audit_log_service_1.AuditLogService.log({
                    userId: req.user.id,
                    employeeId: req.user.id,
                    action: "LOGOUT",
                    module: "AUTH",
                    entityId: req.user.id,
                    description: "User logged out",
                    status: "SUCCESS",
                });
            }
            catch (auditError) {
                logger_1.logger.warn({ error: auditError, employeeId: req.user.id }, "Logout completed, but audit logging failed");
            }
            res.json({
                success: true,
                message: "Logout logged successfully",
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async activity(req, res, next) {
        try {
            const session = req.authSession;
            if (!session ||
                !(await auth_session_service_1.AuthSessionService.renew(session.id, req.user.id))) {
                auth_session_service_1.AuthSessionService.clearCookie(res);
                throw new Error("Unauthorized: session expired due to inactivity");
            }
            auth_session_service_1.AuthSessionService.setCookie(res, session.token);
            res.json({
                success: true,
                message: "Session activity registered",
                data: {
                    idleTimeoutSeconds: env_1.env.authIdleTimeoutSeconds,
                    remainingSeconds: env_1.env.authIdleTimeoutSeconds,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async sessionStatus(req, res, next) {
        try {
            const session = req.authSession;
            if (!session) {
                throw new Error("Unauthorized: session missing");
            }
            const remainingSeconds = await auth_session_service_1.AuthSessionService.remainingSeconds(session.id);
            if (remainingSeconds <= 0) {
                auth_session_service_1.AuthSessionService.clearCookie(res);
                throw new Error("Unauthorized: session expired due to inactivity");
            }
            res.json({
                success: true,
                message: "Session active",
                data: {
                    idleTimeoutSeconds: env_1.env.authIdleTimeoutSeconds,
                    remainingSeconds,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map