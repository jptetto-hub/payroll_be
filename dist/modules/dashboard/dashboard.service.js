"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const client_1 = require("@prisma/client");
const dashboard_repository_1 = require("./dashboard.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const app_error_1 = require("../../shared/utils/app-error");
const cache_1 = require("../../utils/cache");
const parseFromDate = (value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const parseToDate = (value) => value ? new Date(`${value}T23:59:59.999Z`) : undefined;
const parseRange = (query) => {
    const from = parseFromDate(query.from);
    const to = parseToDate(query.to);
    if (from && Number.isNaN(from.getTime())) {
        throw new app_error_1.AppError("Invalid from date. Use YYYY-MM-DD", 400);
    }
    if (to && Number.isNaN(to.getTime())) {
        throw new app_error_1.AppError("Invalid to date. Use YYYY-MM-DD", 400);
    }
    if (from && to && from > to) {
        throw new app_error_1.AppError("from date cannot be greater than to date", 400);
    }
    return { from, to };
};
const countBy = (rows, key, value) => {
    const count = rows.find((row) => row[key] === value)?._count;
    return Number(count?._all ?? count ?? 0);
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key) => {
    const [year = 1970, month = 1] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
};
const getEmployeeScope = (query, user) => (0, employee_scope_util_1.resolveEmployeeScope)({
    authUser: user,
    employeeId: query.employeeId,
}).employeeWhere;
const getDirectEmployeeId = (query, user) => {
    if (user.role === client_1.Role.USER)
        return user.id;
    return query.employeeId && query.employeeId !== "all"
        ? query.employeeId
        : undefined;
};
const employeeActivity = (employee) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.name,
});
const dashboardCacheKey = (section, query, user) => cache_1.CacheService.buildKey("dashboard", section, user.role, user.id, query.employeeId || "scope", query.from || "all", query.to || "all", query.page || 1, query.limit || "default", query.search || "", query.compact || false);
class DashboardService {
    static async summary(query, user) {
        const cacheKey = dashboardCacheKey("summary", query, user);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const employeeWhere = getEmployeeScope(query, user);
        const employeeId = getDirectEmployeeId(query, user);
        const range = parseRange(query);
        const [employeeCounts, payrollResult, advanceResult, attendanceRows, approvalRows,] = await Promise.all([
            dashboard_repository_1.DashboardRepository.employeeSummary(employeeWhere, employeeId),
            dashboard_repository_1.DashboardRepository.payrollSummary(employeeWhere, range, employeeId),
            dashboard_repository_1.DashboardRepository.advanceSummary(employeeWhere, range, employeeId),
            dashboard_repository_1.DashboardRepository.attendanceSummary(employeeWhere, range, employeeId),
            dashboard_repository_1.DashboardRepository.approvalSummary(employeeWhere, range, employeeId),
        ]);
        const [total, active, inactive, weekly, monthly] = employeeCounts;
        const [payrollRows, payrollSums, carryForwardSums, payrollAttendance] = payrollResult;
        const [advanceRows, advanceSums] = advanceResult;
        const missing = payrollAttendance.reduce((sum, item) => {
            const breakdown = item.attendanceBreakdown;
            return sum + Number(breakdown?.missingDays ?? 0);
        }, 0);
        const result = {
            employees: {
                total,
                active,
                inactive,
                weekly,
                monthly,
            },
            payroll: {
                generated: countBy(payrollRows, "status", client_1.PayrollStatus.GENERATED),
                paid: countBy(payrollRows, "status", client_1.PayrollStatus.PAID),
                cancelled: countBy(payrollRows, "status", client_1.PayrollStatus.CANCELLED),
                superseded: countBy(payrollRows, "status", client_1.PayrollStatus.SUPERSEDED),
                totalSalary: Number(payrollSums._sum.finalSalary ?? 0),
                otTotalHours: Number(payrollSums._sum.otTotalHours ?? 0),
                otEarnings: Number(payrollSums._sum.otEarnings ?? 0),
                totalDeductions: Number(payrollSums._sum.totalDeduction ??
                    payrollSums._sum.advanceDeduction ??
                    0),
                carryForwardBalance: Number(carryForwardSums._sum.remainingAmount ?? 0),
            },
            advances: {
                settled: countBy(advanceRows, "settlementStatus", client_1.AdvanceSettlementStatus.SETTLED),
                unsettled: countBy(advanceRows, "settlementStatus", client_1.AdvanceSettlementStatus.UNSETTLED),
                partiallySettled: countBy(advanceRows, "settlementStatus", client_1.AdvanceSettlementStatus.PARTIALLY_SETTLED),
                totalAdvanceAmount: Number(advanceSums._sum.amount ?? 0),
                remainingAmount: Number(advanceSums._sum.remainingAmount ?? 0),
            },
            attendance: {
                present: countBy(attendanceRows, "status", client_1.AttendanceStatus.PRESENT),
                absent: countBy(attendanceRows, "status", client_1.AttendanceStatus.ABSENT),
                halfDay: countBy(attendanceRows, "status", client_1.AttendanceStatus.HALF_DAY),
                missing,
            },
            approvals: {
                pending: countBy(approvalRows, "status", client_1.RequestStatus.PENDING),
                approved: countBy(approvalRows, "status", client_1.RequestStatus.APPROVED),
                rejected: countBy(approvalRows, "status", client_1.RequestStatus.REJECTED),
            },
        };
        await cache_1.CacheService.set(cacheKey, result, 60);
        return result;
    }
    static async recentPayroll(query, user) {
        const cacheKey = dashboardCacheKey("recent-payroll", query, user);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const employeeWhere = getEmployeeScope(query, user);
        const employeeId = getDirectEmployeeId(query, user);
        const range = parseRange(query);
        const [records, total] = await dashboard_repository_1.DashboardRepository.recentPayroll({
            skip,
            take,
            employeeWhere,
            employeeId,
            range,
            search: query.search,
            includeTotal: query.compact !== "true",
        });
        const result = {
            data: records.map((payroll) => ({
                payrollId: payroll.id,
                employeeId: payroll.employeeId,
                employeeCode: payroll.employee.employeeCode,
                employeeName: payroll.employee.name,
                salaryType: payroll.employee.salaryType,
                periodStart: formatDate(payroll.periodStart),
                periodEnd: formatDate(payroll.periodEnd),
                finalSalary: Number(payroll.finalSalary),
                status: payroll.status,
                createdAt: payroll.createdAt,
            })),
            pagination: (0, pagination_util_1.buildPaginationMeta)(query.compact === "true" ? records.length : total, page, limit),
        };
        await cache_1.CacheService.set(cacheKey, result, 60);
        return result;
    }
    static async recentActivities(query, user) {
        const cacheKey = dashboardCacheKey("recent-activities", query, user);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const employeeWhere = getEmployeeScope(query, user);
        const employeeId = getDirectEmployeeId(query, user);
        if (query.compact === "true") {
            const auditLogs = await dashboard_repository_1.DashboardRepository.recentCompactActivities({
                employeeWhere,
                employeeId,
                take: skip + take,
            });
            const data = auditLogs.slice(skip, skip + take).map((item) => {
                const employee = item.employee ?? item.user;
                return {
                    id: item.id,
                    module: item.module,
                    action: item.action,
                    employeeId: employee?.id ?? null,
                    employeeCode: employee?.employeeCode ?? null,
                    employeeName: employee?.name ?? null,
                    summary: item.description || `${item.module} ${item.action}`,
                    status: item.status || item.action,
                    timestamp: item.createdAt,
                };
            });
            const response = {
                data,
                pagination: (0, pagination_util_1.buildPaginationMeta)(data.length, page, limit),
            };
            await cache_1.CacheService.set(cacheKey, response, 30);
            return response;
        }
        const result = await dashboard_repository_1.DashboardRepository.recentActivities({
            employeeWhere,
            take: skip + take,
            includeTotal: query.compact !== "true",
        });
        const activities = [
            ...result.records.payroll.map((item) => ({
                id: item.id,
                module: "PAYROLL",
                action: item.isRecalculated ? "PAYROLL_RECALCULATE" : "PAYROLL_GENERATE",
                ...employeeActivity(item.employee),
                summary: `Payroll generated for ${formatDate(item.periodStart)} to ${formatDate(item.periodEnd)}`,
                status: item.status,
                timestamp: item.createdAt,
            })),
            ...result.records.attendance.map((item) => ({
                id: item.id,
                module: "ATTENDANCE",
                action: "ATTENDANCE_UPDATE",
                ...employeeActivity(item.employee),
                summary: `Attendance marked ${item.status} for ${formatDate(item.date)}`,
                status: item.status,
                timestamp: item.updatedAt,
            })),
            ...result.records.advances.map((item) => ({
                id: item.id,
                module: "ADVANCE",
                action: "ADVANCE_UPDATE",
                ...employeeActivity(item.employee),
                summary: `Advance ${item.settlementStatus.toLowerCase()} for ${formatDate(item.date)}`,
                status: item.settlementStatus,
                timestamp: item.updatedAt,
            })),
            ...result.records.requests.map((item) => ({
                id: item.id,
                module: "ATTENDANCE_REQUEST",
                action: item.status,
                ...employeeActivity(item.employee),
                summary: `${item.requestType} attendance request for ${formatDate(item.attendanceDate)}`,
                status: item.status,
                timestamp: item.updatedAt,
            })),
            ...result.records.salaryHistory.map((item) => ({
                id: item.id,
                module: "SALARY_HISTORY",
                action: "SALARY_HISTORY_UPDATE",
                ...employeeActivity(item.employee),
                summary: `Salary history effective from ${formatDate(item.effectiveFrom)}`,
                status: item.employee.status,
                timestamp: item.updatedAt,
            })),
            ...result.records.auditLogs.map((item) => ({
                id: item.id,
                module: item.module,
                action: item.action,
                employeeId: item.user?.id ?? null,
                employeeCode: item.user?.employeeCode ?? null,
                employeeName: item.user?.name ?? null,
                summary: `${item.module} ${item.action}`,
                status: item.action,
                timestamp: item.createdAt,
            })),
            ...result.records.ledger.map((item) => ({
                id: item.id,
                module: "LEDGER",
                action: item.type,
                ...employeeActivity(item.employee),
                summary: `${item.type} ledger entry for ${formatDate(item.date)}`,
                status: item.type,
                timestamp: item.createdAt,
            })),
            ...result.records.employees.map((item) => ({
                id: item.id,
                module: "EMPLOYEE",
                action: "EMPLOYEE_CREATE",
                ...employeeActivity(item),
                summary: `Employee ${item.employeeCode} created`,
                status: item.status,
                timestamp: item.createdAt,
            })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const response = {
            data: activities.slice(skip, skip + take),
            pagination: (0, pagination_util_1.buildPaginationMeta)(result.total, page, limit),
        };
        await cache_1.CacheService.set(cacheKey, response, 30);
        return response;
    }
    static async analytics(query, user) {
        const cacheKey = dashboardCacheKey("analytics", query, user);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const employeeWhere = getEmployeeScope(query, user);
        const employeeId = getDirectEmployeeId(query, user);
        const range = parseRange(query);
        const [payrollRows, attendanceRows, advanceRows] = await dashboard_repository_1.DashboardRepository.analytics(employeeWhere, range, employeeId);
        const payrollTrend = new Map();
        const attendanceTrend = new Map();
        const advanceTrend = new Map();
        const payrollStatusComparison = {
            generated: 0,
            paid: 0,
            cancelled: 0,
            superseded: 0,
        };
        for (const item of payrollRows) {
            const key = monthKey(item.periodStart);
            const payrollCount = Number(item._count ?? 0);
            const row = payrollTrend.get(key) ?? {
                label: monthLabel(key),
                totalPayroll: 0,
                totalSalary: 0,
                totalDeductions: 0,
            };
            row.totalPayroll += payrollCount;
            row.totalSalary += Number(item._sum.finalSalary ?? 0);
            row.totalDeductions += Number(item._sum.totalDeduction ?? item._sum.advanceDeduction ?? 0);
            payrollTrend.set(key, row);
            if (item.status === client_1.PayrollStatus.GENERATED) {
                payrollStatusComparison.generated += payrollCount;
            }
            else if (item.status === client_1.PayrollStatus.PAID) {
                payrollStatusComparison.paid += payrollCount;
            }
            else if (item.status === client_1.PayrollStatus.CANCELLED) {
                payrollStatusComparison.cancelled += payrollCount;
            }
            else if (item.status === client_1.PayrollStatus.SUPERSEDED) {
                payrollStatusComparison.superseded += payrollCount;
            }
        }
        for (const item of attendanceRows) {
            const key = monthKey(item.date);
            const attendanceCount = Number(item._count ?? 0);
            const row = attendanceTrend.get(key) ?? {
                label: monthLabel(key),
                present: 0,
                absent: 0,
                halfDay: 0,
            };
            if (item.status === client_1.AttendanceStatus.PRESENT)
                row.present += attendanceCount;
            if (item.status === client_1.AttendanceStatus.ABSENT)
                row.absent += attendanceCount;
            if (item.status === client_1.AttendanceStatus.HALF_DAY)
                row.halfDay += attendanceCount;
            attendanceTrend.set(key, row);
        }
        for (const item of advanceRows) {
            const key = monthKey(item.date);
            const row = advanceTrend.get(key) ?? {
                label: monthLabel(key),
                totalAdvance: 0,
                settled: 0,
                remaining: 0,
            };
            row.totalAdvance += Number(item._sum.amount ?? 0);
            row.settled += Number(item._sum.settledAmount ?? 0);
            row.remaining += Number(item._sum.remainingAmount ?? 0);
            advanceTrend.set(key, row);
        }
        const byLabelDate = (a, b) => new Date(a.label).getTime() - new Date(b.label).getTime();
        const result = {
            payrollTrend: [...payrollTrend.values()].sort(byLabelDate),
            attendanceTrend: [...attendanceTrend.values()].sort(byLabelDate),
            advanceTrend: [...advanceTrend.values()].sort(byLabelDate),
            payrollStatusComparison,
        };
        await cache_1.CacheService.set(cacheKey, result, 60 * 2);
        return result;
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboard.service.js.map