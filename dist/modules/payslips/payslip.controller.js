"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayslipController = void 0;
const payslip_service_1 = require("./payslip.service");
class PayslipController {
    static async list(req, res, next) {
        try {
            const result = await payslip_service_1.PayslipService.list(req.query, req.user);
            res.json({
                success: true,
                message: "Payslips fetched successfully",
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
            const result = await payslip_service_1.PayslipService.myPayslips(req.user.id, req.query);
            res.json({
                success: true,
                message: "My payslips fetched successfully",
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
            const result = await payslip_service_1.PayslipService.getById(req.params.id, req.user);
            res.json({
                success: true,
                message: "Payslip fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getByPayroll(req, res, next) {
        try {
            const result = await payslip_service_1.PayslipService.getByPayroll(req.params.payrollId, req.user.role);
            res.json({
                success: true,
                message: "Payroll payslip fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByEmployee(req, res, next) {
        try {
            const result = await payslip_service_1.PayslipService.listByEmployee(req.params.employeeId, req.user.role, req.query);
            res.json({
                success: true,
                message: "Employee payslips fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async retryGeneration(req, res, next) {
        try {
            await payslip_service_1.PayslipService.retryGeneration(req.params.id);
            res.json({
                success: true,
                message: "Payslip generation retry queued",
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PayslipController = PayslipController;
//# sourceMappingURL=payslip.controller.js.map