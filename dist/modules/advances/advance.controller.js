"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvanceController = void 0;
const advance_service_1 = require("./advance.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class AdvanceController {
    static async deductionPreview(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.deductionPreview(req.body, req.user.role);
            res.json({
                success: true,
                message: "Advance deduction preview generated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.createAdvance(req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "ADVANCE",
                newData: result,
                ipAddress: req.ip,
            });
            res.status(201).json({
                success: true,
                message: "Advance created successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async list(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.listAdvances(req.query, req.user);
            res.json({
                success: true,
                message: "Advances fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async my(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.myAdvances(req.user.id, req.query);
            res.json({
                success: true,
                message: "My advances fetched successfully",
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
            const result = await advance_service_1.AdvanceService.getAdvanceById(req.params.id, req.user);
            res.json({
                success: true,
                message: "Advance fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByEmployee(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.listByEmployee(req.params.employeeId, req.user.role, req.query);
            res.json({
                success: true,
                message: "Employee advances fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByCycle(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.listByCycle(req.params.employeeId, req.query.cycleStartDate, req.query.cycleEndDate, req.user.role);
            res.json({
                success: true,
                message: "Cycle advances fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getManualDeduction(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.getManualDeduction(req.params.employeeId, req.query.periodStart, req.query.periodEnd, req.user.role);
            res.json({
                success: true,
                message: "Manual advance deduction fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async upsertManualDeduction(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.upsertManualDeduction(req.body, req.user.role, req.user.id);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "ADVANCE",
                newData: result,
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Manual advance deduction saved successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteManualDeduction(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.deleteManualDeduction(req.params.id, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "ADVANCE",
                newData: {
                    deletedManualDeduction: result,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Manual advance deduction deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.updateAdvance(req.params.id, req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "ADVANCE",
                newData: {
                    advance: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Advance updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const result = await advance_service_1.AdvanceService.deleteAdvance(req.params.id, req.user.role, req.body.reason);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "ADVANCE",
                newData: {
                    deletedAdvance: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Advance deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AdvanceController = AdvanceController;
//# sourceMappingURL=advance.controller.js.map