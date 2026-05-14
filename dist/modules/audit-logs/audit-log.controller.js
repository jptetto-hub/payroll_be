"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const audit_log_service_1 = require("./audit-log.service");
class AuditLogController {
    static async list(req, res, next) {
        try {
            const result = await audit_log_service_1.AuditLogService.list(req.query);
            res.json({
                success: true,
                message: "Audt logs fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const result = await audit_log_service_1.AuditLogService.getById(req.params.id);
            res.json({
                success: true,
                message: "Audit log fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByUser(req, res, next) {
        try {
            const result = await audit_log_service_1.AuditLogService.listByUser(req.params.userId, req.query);
            res.json({
                success: true,
                message: "User audit logs fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuditLogController = AuditLogController;
//# sourceMappingURL=audit-log.controller.js.map