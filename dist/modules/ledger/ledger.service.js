"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const client_1 = require("@prisma/client");
const ledger_repository_1 = require("./ledger.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const ensureEmployeeAccess = (targetRole, currentRole) => {
    if (currentRole === client_1.Role.ADMIN && targetRole !== client_1.Role.USER) {
        throw new Error("ADMIN can access ledger only for USER employees");
    }
};
class LedgerService {
    static async createAdvanceLedger(params) {
        const lastBalance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        const balance = lastBalance - params.amount;
        return ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            type: client_1.LedgerType.ADVANCE,
            referenceId: params.advanceId,
            debit: params.amount,
            credit: 0,
            balance,
            date: params.date,
        });
    }
    static async createPayrollLedger(params) {
        const entries = [];
        let balance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        balance += params.grossSalary;
        const salaryEntry = await ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            payrollId: params.payrollId,
            type: client_1.LedgerType.SALARY,
            referenceId: params.payrollId,
            debit: 0,
            credit: params.grossSalary,
            balance,
            date: params.date,
        });
        entries.push(salaryEntry);
        if (params.advanceDeduction > 0) {
            balance -= params.advanceDeduction;
            const deductionEntry = await ledger_repository_1.LedgerRepository.create({
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: client_1.LedgerType.DEDUCTION,
                referenceId: params.payrollId,
                debit: params.advanceDeduction,
                credit: 0,
                balance,
                date: params.date,
            });
            entries.push(deductionEntry);
        }
        return entries;
    }
    static async createAdjustmentLedger(params) {
        const difference = params.newFinalSalary - params.oldFinalSalary;
        if (difference === 0) {
            return null;
        }
        let balance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        if (difference > 0) {
            balance += difference;
            return ledger_repository_1.LedgerRepository.create({
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: client_1.LedgerType.ADJUSTMENT,
                referenceId: params.payrollId,
                debit: 0,
                credit: difference,
                balance,
                date: params.date,
            });
        }
        balance -= Math.abs(difference);
        return ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            payrollId: params.payrollId,
            type: client_1.LedgerType.ADJUSTMENT,
            referenceId: params.payrollId,
            debit: Math.abs(difference),
            credit: 0,
            balance,
            date: params.date,
        });
    }
    static async list(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const [entries, total] = await ledger_repository_1.LedgerRepository.listAll({
            skip,
            take,
            employeeWhere,
            payrollId: query.payrollId,
            type: query.type,
        });
        return {
            data: entries,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async myLedger(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [entries, total] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByEmployee(employeeId, { skip, take }),
            ledger_repository_1.LedgerRepository.countByEmployee(employeeId),
        ]);
        return {
            data: entries,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async employeeLedger(employeeId, currentRole, query) {
        const employee = await ledger_repository_1.LedgerRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureEmployeeAccess(employee.role, currentRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [entries, total] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByEmployee(employeeId, { skip, take }),
            ledger_repository_1.LedgerRepository.countByEmployee(employeeId),
        ]);
        return {
            data: entries,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async payrollLedger(payrollId, currentRole, query) {
        const payroll = await ledger_repository_1.LedgerRepository.findPayroll(payrollId);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        ensureEmployeeAccess(payroll.employee.role, currentRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [entries, total] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByPayroll(payrollId, { skip, take }),
            ledger_repository_1.LedgerRepository.countByPayroll(payrollId),
        ]);
        return {
            data: entries,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.service.js.map