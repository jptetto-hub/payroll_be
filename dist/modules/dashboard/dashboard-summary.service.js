"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardSummaryService = exports.parseDashboardSummaryRange = exports.buildGlobalDashboardSummaryKey = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const app_error_1 = require("../../shared/utils/app-error");
const cache_1 = require("../../utils/cache");
const logger_1 = require("../../config/logger");
const parseFromDate = (value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const parseToDate = (value) => value ? new Date(`${value}T23:59:59.999Z`) : undefined;
const buildGlobalDashboardSummaryKey = (periodStart, periodEnd) => `GLOBAL_${periodStart?.toISOString() || "ALL"}_${periodEnd?.toISOString() || "ALL"}`;
exports.buildGlobalDashboardSummaryKey = buildGlobalDashboardSummaryKey;
const buildDashboardCacheKey = (periodStart, periodEnd) => cache_1.CacheService.buildKey("dashboard-summary", periodStart?.toISOString().slice(0, 10) || "all", periodEnd?.toISOString().slice(0, 10) || "all");
const parseDashboardSummaryRange = (query) => {
    const periodStart = parseFromDate(query.from);
    const periodEnd = parseToDate(query.to);
    if (periodStart && Number.isNaN(periodStart.getTime())) {
        throw new app_error_1.AppError("Invalid from date. Use YYYY-MM-DD", 400);
    }
    if (periodEnd && Number.isNaN(periodEnd.getTime())) {
        throw new app_error_1.AppError("Invalid to date. Use YYYY-MM-DD", 400);
    }
    if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
        throw new app_error_1.AppError("Both from and to dates are required", 400);
    }
    if (periodStart && periodEnd && periodStart > periodEnd) {
        throw new app_error_1.AppError("from date cannot be greater than to date", 400);
    }
    return { periodStart, periodEnd };
};
exports.parseDashboardSummaryRange = parseDashboardSummaryRange;
class DashboardSummaryService {
    static emptyGlobalSummary(params) {
        return {
            summaryKey: (0, exports.buildGlobalDashboardSummaryKey)(params.periodStart, params.periodEnd),
            type: client_1.DashboardSummaryType.GLOBAL,
            employeeId: null,
            periodStart: params.periodStart ?? null,
            periodEnd: params.periodEnd ?? null,
            totalEmployees: 0,
            activeEmployees: 0,
            inactiveEmployees: 0,
            pendingAttendanceRequests: 0,
            approvedAttendanceRequests: 0,
            rejectedAttendanceRequests: 0,
            generatedPayrolls: 0,
            paidPayrolls: 0,
            cancelledPayrolls: 0,
            grossSalaryTotal: 0,
            advanceDeductionTotal: 0,
            finalSalaryTotal: 0,
            outstandingAdvanceTotal: 0,
            ledgerSalaryTotal: 0,
            ledgerAdvanceTotal: 0,
            ledgerDeductionTotal: 0,
            ledgerAdjustmentTotal: 0,
            calculatedAt: new Date(),
            isRefreshing: true,
        };
    }
    static async refreshGlobalSummary(params) {
        const { periodStart, periodEnd } = params;
        const summaryKey = (0, exports.buildGlobalDashboardSummaryKey)(periodStart, periodEnd);
        const payrollWhere = {};
        const ledgerWhere = {};
        const attendanceRequestWhere = {};
        if (periodStart && periodEnd) {
            payrollWhere.periodStart = {
                gte: periodStart,
            };
            payrollWhere.periodEnd = {
                lte: periodEnd,
            };
            ledgerWhere.date = {
                gte: periodStart,
                lte: periodEnd,
            };
            attendanceRequestWhere.attendanceDate = {
                gte: periodStart,
                lte: periodEnd,
            };
        }
        const [totalEmployees, activeEmployees, inactiveEmployees, pendingAttendanceRequests, approvedAttendanceRequests, rejectedAttendanceRequests, generatedPayrolls, paidPayrolls, cancelledPayrolls, payrollSalaryAgg, outstandingAdvanceAgg, salaryLedgerAgg, advanceLedgerAgg, deductionLedgerAgg, adjustmentDebitAgg, adjustmentCreditAgg,] = await Promise.all([
            prisma_1.prisma.employee.count(),
            prisma_1.prisma.employee.count({
                where: {
                    status: client_1.EmployeeStatus.ACTIVE,
                },
            }),
            prisma_1.prisma.employee.count({
                where: {
                    status: client_1.EmployeeStatus.INACTIVE,
                },
            }),
            prisma_1.prisma.attendanceRequest.count({
                where: {
                    ...attendanceRequestWhere,
                    status: client_1.RequestStatus.PENDING,
                },
            }),
            prisma_1.prisma.attendanceRequest.count({
                where: {
                    ...attendanceRequestWhere,
                    status: client_1.RequestStatus.APPROVED,
                },
            }),
            prisma_1.prisma.attendanceRequest.count({
                where: {
                    ...attendanceRequestWhere,
                    status: client_1.RequestStatus.REJECTED,
                },
            }),
            prisma_1.prisma.payroll.count({
                where: {
                    ...payrollWhere,
                    status: client_1.PayrollStatus.GENERATED,
                },
            }),
            prisma_1.prisma.payroll.count({
                where: {
                    ...payrollWhere,
                    status: client_1.PayrollStatus.PAID,
                },
            }),
            prisma_1.prisma.payroll.count({
                where: {
                    ...payrollWhere,
                    status: client_1.PayrollStatus.CANCELLED,
                },
            }),
            prisma_1.prisma.payroll.aggregate({
                where: {
                    ...payrollWhere,
                    status: {
                        not: client_1.PayrollStatus.CANCELLED,
                    },
                },
                _sum: {
                    grossSalary: true,
                    advanceDeduction: true,
                    finalSalary: true,
                },
            }),
            prisma_1.prisma.advancePayment.aggregate({
                where: {
                    isSettled: false,
                },
                _sum: {
                    remainingAmount: true,
                },
            }),
            prisma_1.prisma.ledgerEntry.aggregate({
                where: {
                    ...ledgerWhere,
                    type: client_1.LedgerType.SALARY,
                },
                _sum: {
                    credit: true,
                },
            }),
            prisma_1.prisma.ledgerEntry.aggregate({
                where: {
                    ...ledgerWhere,
                    type: client_1.LedgerType.ADVANCE,
                },
                _sum: {
                    debit: true,
                },
            }),
            prisma_1.prisma.ledgerEntry.aggregate({
                where: {
                    ...ledgerWhere,
                    type: client_1.LedgerType.DEDUCTION,
                },
                _sum: {
                    debit: true,
                },
            }),
            prisma_1.prisma.ledgerEntry.aggregate({
                where: {
                    ...ledgerWhere,
                    type: client_1.LedgerType.ADJUSTMENT,
                },
                _sum: {
                    debit: true,
                },
            }),
            prisma_1.prisma.ledgerEntry.aggregate({
                where: {
                    ...ledgerWhere,
                    type: client_1.LedgerType.ADJUSTMENT,
                },
                _sum: {
                    credit: true,
                },
            }),
        ]);
        const summaryData = {
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            pendingAttendanceRequests,
            approvedAttendanceRequests,
            rejectedAttendanceRequests,
            generatedPayrolls,
            paidPayrolls,
            cancelledPayrolls,
            grossSalaryTotal: payrollSalaryAgg._sum?.grossSalary || 0,
            advanceDeductionTotal: payrollSalaryAgg._sum?.advanceDeduction || 0,
            finalSalaryTotal: payrollSalaryAgg._sum?.finalSalary || 0,
            outstandingAdvanceTotal: outstandingAdvanceAgg._sum.remainingAmount || 0,
            ledgerSalaryTotal: salaryLedgerAgg._sum?.credit || 0,
            ledgerAdvanceTotal: advanceLedgerAgg._sum?.debit || 0,
            ledgerDeductionTotal: deductionLedgerAgg._sum?.debit || 0,
            ledgerAdjustmentTotal: Number(adjustmentDebitAgg._sum?.debit || 0) +
                Number(adjustmentCreditAgg._sum?.credit || 0),
            calculatedAt: new Date(),
        };
        const summary = await prisma_1.prisma.dashboardSummary.upsert({
            where: {
                summaryKey,
            },
            update: summaryData,
            create: {
                summaryKey,
                type: client_1.DashboardSummaryType.GLOBAL,
                employeeId: null,
                periodStart: periodStart || null,
                periodEnd: periodEnd || null,
                ...summaryData,
            },
        });
        await cache_1.CacheService.delByPattern("dashboard-summary:*");
        return summary;
    }
    static async getGlobalSummary(params) {
        const cached = await cache_1.CacheService.get(buildDashboardCacheKey(params.periodStart, params.periodEnd));
        if (cached) {
            return cached;
        }
        const summaryKey = (0, exports.buildGlobalDashboardSummaryKey)(params.periodStart, params.periodEnd);
        const summary = await prisma_1.readPrisma.dashboardSummary.findUnique({
            where: {
                summaryKey,
            },
        });
        if (summary) {
            await cache_1.CacheService.set(buildDashboardCacheKey(params.periodStart, params.periodEnd), summary, 60 * 2);
        }
        return summary;
    }
    static async getOrRefreshGlobalSummary(params) {
        const summary = await this.getGlobalSummary(params);
        if (summary) {
            return summary;
        }
        const latestSummary = await prisma_1.readPrisma.dashboardSummary.findFirst({
            where: {
                type: client_1.DashboardSummaryType.GLOBAL,
            },
            orderBy: {
                calculatedAt: "desc",
            },
        });
        void this.refreshGlobalSummary(params).catch((error) => {
            logger_1.logger.error({ error }, "Dashboard summary background refresh failed");
        });
        return latestSummary
            ? {
                ...latestSummary,
                isRefreshing: true,
            }
            : this.emptyGlobalSummary(params);
    }
}
exports.DashboardSummaryService = DashboardSummaryService;
//# sourceMappingURL=dashboard-summary.service.js.map