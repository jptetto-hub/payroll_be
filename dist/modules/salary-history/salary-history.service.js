"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryHistoryService = void 0;
const client_1 = require("@prisma/client");
const salary_history_repository_1 = require("./salary-history.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const cache_1 = require("../../utils/cache");
const app_error_1 = require("../../shared/utils/app-error");
const formatDate = (date) => date.toISOString().slice(0, 10);
const SALARY_HISTORY_READ_CACHE_PREFIX = "salary-history-read";
const SALARY_HISTORY_READ_CACHE_TTL = 60;
const invalidateSalaryHistoryReadCaches = (employeeId) => {
    void Promise.all([
        cache_1.CacheService.delByPattern(`${SALARY_HISTORY_READ_CACHE_PREFIX}:${employeeId}:*`),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
    ]);
};
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
class SalaryHistoryService {
    static ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId) {
        if (currentUserRole === client_1.Role.USER && employeeId !== currentUserId) {
            throw new Error("USER can view only own salary history");
        }
    }
    static async createSalaryHistory(data) {
        const employee = await salary_history_repository_1.SalaryHistoryRepository.findEmployee(data.employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        if (employee.status !== "ACTIVE") {
            throw new Error("Cannot add salary history for inactive employee");
        }
        const effectiveFrom = new Date(data.effectiveFrom);
        if (Number.isNaN(effectiveFrom.getTime())) {
            throw new Error("Invalid effectiveFrom date format");
        }
        ensureDateOnOrAfterJoining({
            date: effectiveFrom,
            joiningDate: employee.joiningDate,
            action: "Salary history effective date",
        });
        await (0, payroll_lock_util_1.assertSalaryHistoryNotLocked)({
            employeeId: data.employeeId,
            effectiveFrom,
        });
        const existingRecord = await salary_history_repository_1.SalaryHistoryRepository.findByEmployeeAndEffectiveDate(data.employeeId, effectiveFrom);
        if (existingRecord) {
            throw new Error("Salary history already exists for this employee on this effective date");
        }
        const salaryHistory = await salary_history_repository_1.SalaryHistoryRepository.create({
            employeeId: data.employeeId,
            salaryAmount: data.salaryAmount,
            effectiveFrom,
        });
        invalidateSalaryHistoryReadCaches(data.employeeId);
        return salaryHistory;
    }
    static async listSalaryHistory(employeeId, currentUserRole, currentUserId, query) {
        this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = cache_1.CacheService.buildKey(SALARY_HISTORY_READ_CACHE_PREFIX, employeeId, "list", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [employee, histories, total] = await Promise.all([
            salary_history_repository_1.SalaryHistoryRepository.findEmployeeForRead(employeeId),
            salary_history_repository_1.SalaryHistoryRepository.listByEmployee(employeeId, { skip, take }),
            salary_history_repository_1.SalaryHistoryRepository.countByEmployee(employeeId),
        ]);
        if (!employee) {
            throw new Error("Employee not found");
        }
        const result = {
            data: {
                employee,
                histories,
            },
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, SALARY_HISTORY_READ_CACHE_TTL);
        return result;
    }
    static async getCurrentSalary(employeeId, currentUserRole, currentUserId) {
        this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);
        const cacheKey = cache_1.CacheService.buildKey(SALARY_HISTORY_READ_CACHE_PREFIX, employeeId, "current");
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [employee, salary] = await Promise.all([
            salary_history_repository_1.SalaryHistoryRepository.findEmployeeForRead(employeeId),
            salary_history_repository_1.SalaryHistoryRepository.getCurrentSalary(employeeId),
        ]);
        if (!employee) {
            throw new Error("Employee not found");
        }
        const result = {
            employee,
            salary,
        };
        void cache_1.CacheService.set(cacheKey, result, SALARY_HISTORY_READ_CACHE_TTL);
        return result;
    }
    static async resolveSalary(employeeId, date, currentUserRole, currentUserId) {
        this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);
        const targetDate = new Date(date);
        if (Number.isNaN(targetDate.getTime())) {
            throw new Error("Invalid date format. Use YYYY-MM-DD or ISO date format");
        }
        const cacheKey = cache_1.CacheService.buildKey(SALARY_HISTORY_READ_CACHE_PREFIX, employeeId, "resolve", formatDate(targetDate));
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [employee, salary] = await Promise.all([
            salary_history_repository_1.SalaryHistoryRepository.findEmployeeForRead(employeeId),
            salary_history_repository_1.SalaryHistoryRepository.resolveSalaryByDate(employeeId, targetDate),
        ]);
        if (!employee) {
            throw new Error("Employee not found");
        }
        if (!salary) {
            throw new app_error_1.AppError("No salary history found for the selected date", 404);
        }
        const result = {
            employee,
            targetDate,
            salary,
        };
        void cache_1.CacheService.set(cacheKey, result, SALARY_HISTORY_READ_CACHE_TTL);
        return result;
    }
    static async updateSalaryHistory(id, data, currentUserRole) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can update salary history");
        }
        const existing = await salary_history_repository_1.SalaryHistoryRepository.findById(id);
        if (!existing) {
            throw new Error("Salary history record not found");
        }
        let effectiveFrom;
        if (data.effectiveFrom) {
            effectiveFrom = new Date(data.effectiveFrom);
            if (Number.isNaN(effectiveFrom.getTime())) {
                throw new Error("Invalid effectiveFrom date format");
            }
            ensureDateOnOrAfterJoining({
                date: effectiveFrom,
                joiningDate: existing.employee.joiningDate,
                action: "Salary history effective date",
            });
            const duplicate = await salary_history_repository_1.SalaryHistoryRepository.findByEmployeeAndEffectiveDate(existing.employeeId, effectiveFrom);
            if (duplicate && duplicate.id !== id) {
                throw new Error("Another salary history already exists for this employee on this effective date");
            }
        }
        await (0, payroll_lock_util_1.assertSalaryHistoryNotLocked)({
            employeeId: existing.employeeId,
            effectiveFrom: existing.effectiveFrom,
        });
        if (effectiveFrom) {
            await (0, payroll_lock_util_1.assertSalaryHistoryNotLocked)({
                employeeId: existing.employeeId,
                effectiveFrom,
            });
        }
        const salaryHistory = await salary_history_repository_1.SalaryHistoryRepository.update(id, {
            ...(data.salaryAmount !== undefined && {
                salaryAmount: data.salaryAmount,
            }),
            ...(effectiveFrom && {
                effectiveFrom,
            }),
        });
        invalidateSalaryHistoryReadCaches(existing.employeeId);
        return salaryHistory;
    }
    static async deleteSalaryHistory(id, currentUserRole, reason) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can delete salary history");
        }
        if (!reason || reason.trim().length < 5) {
            throw new Error("Delete reason is required");
        }
        const existing = await salary_history_repository_1.SalaryHistoryRepository.findById(id);
        if (!existing) {
            throw new Error("Salary history record not found");
        }
        const histories = await salary_history_repository_1.SalaryHistoryRepository.listByEmployee(existing.employeeId);
        if (histories.length <= 1) {
            throw new Error("Cannot delete the only salary history record for this employee");
        }
        await (0, payroll_lock_util_1.assertSalaryHistoryNotLocked)({
            employeeId: existing.employeeId,
            effectiveFrom: existing.effectiveFrom,
        });
        const salaryHistory = await salary_history_repository_1.SalaryHistoryRepository.delete(id);
        invalidateSalaryHistoryReadCaches(existing.employeeId);
        return salaryHistory;
    }
}
exports.SalaryHistoryService = SalaryHistoryService;
//# sourceMappingURL=salary-history.service.js.map