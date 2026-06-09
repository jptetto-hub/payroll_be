"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const audit_log_service_1 = require("./audit-log.service");
const audit_context_1 = require("../../shared/audit/audit-context");
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
    static async listArchive(req, res, next) {
        try {
            const result = await audit_log_service_1.AuditLogService.listArchive(req.query);
            res.json({
                success: true,
                message: "Archived audit logs fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async export(req, res, next) {
        try {
            const logs = await audit_log_service_1.AuditLogService.export(req.query);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "EXPORT",
                module: "AUDIT_LOG",
                description: "Exported audit logs",
                status: "SUCCESS",
                ...(0, audit_context_1.getAuditMeta)(req),
            });
            const header = [
                "Timestamp",
                "User",
                "Employee",
                "Module",
                "Action",
                "Description",
                "Status",
                "IP Address",
                "Device",
                "Request ID",
            ];
            const escapeCsv = (value) => {
                const text = String(value ?? "");
                return `"${text.replace(/"/g, '""')}"`;
            };
            const rows = logs.map((log) => [
                log.createdAt?.toISOString?.() ?? log.createdAt,
                log.user
                    ? `${log.user.employeeCode} - ${log.user.name}`
                    : log.userId ?? "",
                log.employee
                    ? `${log.employee.employeeCode} - ${log.employee.name}`
                    : log.employeeId ?? "",
                log.module,
                log.action,
                log.description,
                log.status,
                log.ipAddress,
                log.deviceInfo,
                log.requestId,
            ]);
            const csv = [header, ...rows]
                .map((row) => row.map(escapeCsv).join(","))
                .join("\n");
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${Date.now()}.csv"`);
            res.send(csv);
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