"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayslipService = void 0;
const client_1 = require("@prisma/client");
const payslip_repository_1 = require("./payslip.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const ensureEmployeeAccess = (targetRole, currentRole) => {
    if (currentRole === client_1.Role.ADMIN && targetRole !== client_1.Role.USER) {
        throw new Error("ADMIN can access payslips only for USER employees");
    }
};
class PayslipService {
    static async createFromPayroll(payrollId) {
        const payroll = await payslip_repository_1.PayslipRepository.findPayroll(payrollId);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        if (payroll.status === client_1.PayrollStatus.CANCELLED) {
            throw new Error("Cannot create payslip for cancelled payroll");
        }
        if (payroll.status === client_1.PayrollStatus.SUPERSEDED) {
            throw new Error("Cannot create payslip for superseded payroll");
        }
        const existing = await payslip_repository_1.PayslipRepository.findByPayroll(payrollId);
        if (existing) {
            throw new Error("Payslip already exists for this payroll");
        }
        return payslip_repository_1.PayslipRepository.createFromPayroll(payroll);
    }
    static async list(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const [payslips, total] = await payslip_repository_1.PayslipRepository.listAll({
            skip,
            take,
            employeeWhere,
        });
        return {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async myPayslips(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [payslips, total] = await Promise.all([
            payslip_repository_1.PayslipRepository.listByEmployee(employeeId, { skip, take }),
            payslip_repository_1.PayslipRepository.countByEmployee(employeeId),
        ]);
        return {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async getById(id, currentUser) {
        const payslip = await payslip_repository_1.PayslipRepository.findById(id);
        if (!payslip) {
            throw new Error("Payslip not found");
        }
        if (currentUser.role === client_1.Role.USER &&
            payslip.employeeId !== currentUser.id) {
            throw new Error("You can view only your own payslip");
        }
        ensureEmployeeAccess(payslip.employee.role, currentUser.role);
        return payslip;
    }
    static async getByPayroll(payrollId, currentRole) {
        const payroll = await payslip_repository_1.PayslipRepository.findPayroll(payrollId);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        ensureEmployeeAccess(payroll.employee.role, currentRole);
        const payslip = await payslip_repository_1.PayslipRepository.findByPayroll(payrollId);
        if (!payslip) {
            throw new Error("Payslip not found for this payroll");
        }
        return payslip;
    }
    static async listByEmployee(employeeId, currentRole, query) {
        const employee = await payslip_repository_1.PayslipRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureEmployeeAccess(employee.role, currentRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [payslips, total] = await Promise.all([
            payslip_repository_1.PayslipRepository.listByEmployee(employeeId, { skip, take }),
            payslip_repository_1.PayslipRepository.countByEmployee(employeeId),
        ]);
        return {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.PayslipService = PayslipService;
//# sourceMappingURL=payslip.service.js.map