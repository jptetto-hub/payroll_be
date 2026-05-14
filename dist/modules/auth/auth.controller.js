"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class AuthController {
    static async login(req, res, next) {
        try {
            const { phone, password } = req.body;
            const result = await auth_service_1.AuthService.login(phone, password);
            await audit_log_service_1.AuditLogService.log({
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
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map