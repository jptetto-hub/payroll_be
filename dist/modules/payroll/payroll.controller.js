"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollController = void 0;
const payroll_service_1 = require("./payroll.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class PayrollController {
    static async generate(req, res, next) {
        try {
            const result = await payroll_service_1.PayrollService.generate(req.body, req.user.role, {
                userId: req.user.id,
                ipAddress: req.ip,
            });
            res.status(201).json({
                success: true,
                message: result.carryForward
                    ? "Payroll generated successfully with carry-forward deduction"
                    : "Payroll generated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async list(req, res, next) {
        try {
            const result = await payroll_service_1.PayrollService.list(req.query, req.user);
            res.json({
                success: true,
                message: "Payrolls fetched successfully",
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
            const result = await payroll_service_1.PayrollService.getById(req.params.id);
            res.json({
                success: true,
                message: "Payroll fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByEmployee(req, res, next) {
        try {
            const result = await payroll_service_1.PayrollService.listByEmployee(req.params.employeeId, req.user.role, req.query);
            res.json({
                success: true,
                message: "Employee payrolls fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const result = await payroll_service_1.PayrollService.cancelPayroll(req.params.id, req.user.role, req.body.reason, req.user.id, req.ip);
            res.json({
                success: true,
                message: "Payroll cancelled successfully and related records unlocked",
                data: {
                    payroll: result.payroll,
                    unlocked: result.unlocked,
                    reversedAdvances: result.reversedAdvances,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async recalculate(req, res, next) {
        try {
            const result = await payroll_service_1.PayrollService.recalculatePayroll(req.params.id, req.user.role, req.body.reason, req.user.id);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "PAYROLL_RECALCULATE",
                module: "PAYROLL",
                newData: {
                    recalculation: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Payroll recalculated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PayrollController = PayrollController;
//# sourceMappingURL=payroll.controller.js.map