"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayslipService = void 0;
const client_1 = require("@prisma/client");
const payslip_repository_1 = require("./payslip.repository");
const payslip_queue_1 = require("../../jobs/payslip.queue");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const performanceTimer_1 = require("../../utils/performanceTimer");
const cache_1 = require("../../utils/cache");
const PAYSLIP_READ_CACHE_PREFIX = "payslip-read";
const PAYSLIP_READ_CACHE_TTL = 30;
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const parseOptionalDateOnly = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        return undefined;
    }
    return parseDateOnly(value);
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const parseDateRange = (query) => {
    const from = parseOptionalDateOnly(query.from);
    const to = parseOptionalDateOnly(query.to);
    if (from && to && from > to) {
        throw new Error("From date cannot be greater than To date");
    }
    return { from, to };
};
const invalidatePayslipReadCaches = () => {
    void Promise.all([
        cache_1.CacheService.delByPattern(`${PAYSLIP_READ_CACHE_PREFIX}:*`),
        cache_1.CacheService.delByPattern("payroll-read:*"),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
    ]);
};
const ensureEmployeeAccess = (targetRole, currentRole) => {
    if (currentRole === client_1.Role.ADMIN && targetRole !== client_1.Role.USER) {
        throw new Error("ADMIN can access payslips only for USER employees");
    }
};
class PayslipService {
    static async createFromPayroll(payrollId) {
        const timer = new performanceTimer_1.PerformanceTimer("PayslipService.createFromPayroll");
        timer.checkpoint("start");
        const payroll = await payslip_repository_1.PayslipRepository.findPayroll(payrollId);
        timer.checkpoint("payroll fetch");
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        if (payroll.status === client_1.PayrollStatus.CANCELLED) {
            throw new Error("Cannot create payslip for cancelled payroll");
        }
        if (payroll.status === client_1.PayrollStatus.SUPERSEDED) {
            throw new Error("Cannot create payslip for superseded payroll");
        }
        const payslip = await payslip_repository_1.PayslipRepository.createFromPayroll(payroll);
        timer.checkpoint("payslip upsert");
        invalidatePayslipReadCaches();
        timer.end();
        return payslip;
    }
    static async retryGeneration(id) {
        const payslip = await payslip_repository_1.PayslipRepository.findRetryTarget(id);
        if (!payslip) {
            throw new Error("Payslip not found");
        }
        await payslip_repository_1.PayslipRepository.markRetryQueued(payslip.id);
        await payslip_queue_1.payslipQueue.add("generate-payslip", {
            payrollId: payslip.payrollId,
        }, {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
            removeOnComplete: false,
            removeOnFail: false,
        });
        invalidatePayslipReadCaches();
        return payslip;
    }
    static async list(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const dateRange = parseDateRange(query);
        const { directEmployeeId, employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const cacheKey = cache_1.CacheService.buildKey(PAYSLIP_READ_CACHE_PREFIX, "list", authUser.role, authUser.id, query.employeeId ?? "all", dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [payslips, total] = await payslip_repository_1.PayslipRepository.listAll({
            skip,
            take,
            ...(directEmployeeId && { employeeId: directEmployeeId }),
            employeeWhere,
            ...dateRange,
        });
        const result = {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);
        return result;
    }
    static async myPayslips(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const dateRange = parseDateRange(query);
        const cacheKey = cache_1.CacheService.buildKey(PAYSLIP_READ_CACHE_PREFIX, "my", employeeId, dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [payslips, total] = await Promise.all([
            payslip_repository_1.PayslipRepository.listByEmployee(employeeId, { skip, take }, dateRange),
            payslip_repository_1.PayslipRepository.countByEmployeeWithFilters(employeeId, dateRange),
        ]);
        const result = {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);
        return result;
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
        const dateRange = parseDateRange(query);
        const cacheKey = cache_1.CacheService.buildKey(PAYSLIP_READ_CACHE_PREFIX, "employee", employeeId, dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [payslips, total] = await Promise.all([
            payslip_repository_1.PayslipRepository.listByEmployee(employeeId, { skip, take }, dateRange),
            payslip_repository_1.PayslipRepository.countByEmployeeWithFilters(employeeId, dateRange),
        ]);
        const result = {
            data: payslips,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);
        return result;
    }
}
exports.PayslipService = PayslipService;
//# sourceMappingURL=payslip.service.js.map