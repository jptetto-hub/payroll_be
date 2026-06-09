"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryHistoryController = void 0;
const salary_history_service_1 = require("./salary-history.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class SalaryHistoryController {
    static async create(req, res, next) {
        try {
            const salaryHistory = await salary_history_service_1.SalaryHistoryService.createSalaryHistory(req.body);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "SALARY_HISTORY",
                newData: salaryHistory,
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.status(201).json({
                success: true,
                message: "Salary history added successfully",
                data: salaryHistory,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByEmployee(req, res, next) {
        try {
            const result = await salary_history_service_1.SalaryHistoryService.listSalaryHistory(req.params.employeeId, req.user.role, req.user.id, req.query);
            res.json({
                success: true,
                message: "Salary history fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const result = await salary_history_service_1.SalaryHistoryService.updateSalaryHistory(req.params.id, req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "SALARY_HISTORY",
                newData: {
                    ...result,
                    correctionReason: req.body.correctionReason,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Salary history updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const result = await salary_history_service_1.SalaryHistoryService.deleteSalaryHistory(req.params.id, req.user.role, req.body?.reason);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "SALARY_HISTORY",
                newData: {
                    deletedRecord: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Salary history deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async current(req, res, next) {
        try {
            const result = await salary_history_service_1.SalaryHistoryService.getCurrentSalary(req.params.employeeId, req.user.role, req.user.id);
            res.json({
                success: true,
                message: "Current salary fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async resolve(req, res, next) {
        try {
            const result = await salary_history_service_1.SalaryHistoryService.resolveSalary(req.params.employeeId, req.query.date, req.user.role, req.user.id);
            res.json({
                success: true,
                message: "Salary resolved successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SalaryHistoryController = SalaryHistoryController;
//# sourceMappingURL=salary-history.controller.js.map