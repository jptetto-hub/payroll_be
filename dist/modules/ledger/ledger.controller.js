"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerController = void 0;
const ledger_service_1 = require("./ledger.service");
class LedgerController {
    static async list(req, res, next) {
        try {
            const result = await ledger_service_1.LedgerService.list(req.query, req.user);
            res.json({
                success: true,
                message: "Ledger entries fetched successfully",
                data: result.data,
                pagination: result.pagination,
                summary: result.summary,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async my(req, res, next) {
        try {
            const result = await ledger_service_1.LedgerService.myLedger(req.user.id, req.query);
            res.json({
                success: true,
                message: "My ledger fetched successfully",
                data: result.data,
                pagination: result.pagination,
                summary: result.summary,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async detail(req, res, next) {
        try {
            const entry = await ledger_service_1.LedgerService.detail(req.params.id, req.user);
            res.json({
                success: true,
                message: "Ledger entry fetched successfully",
                data: entry,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async employeeLedger(req, res, next) {
        try {
            const result = await ledger_service_1.LedgerService.employeeLedger(req.params.employeeId, req.user.role, req.query);
            res.json({
                success: true,
                message: "Employee ledger fetched successfully",
                data: result.data,
                pagination: result.pagination,
                summary: result.summary,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async payrollLedger(req, res, next) {
        try {
            const result = await ledger_service_1.LedgerService.payrollLedger(req.params.payrollId, req.user.role, req.query);
            res.json({
                success: true,
                message: "Payroll ledger fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.LedgerController = LedgerController;
//# sourceMappingURL=ledger.controller.js.map