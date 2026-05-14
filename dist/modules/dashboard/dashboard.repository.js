"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardEnums = exports.DashboardRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const dateRange = (from, to) => ({
    ...(from && { gte: from }),
    ...(to && { lte: to }),
});
const hasDateRange = (range) => Boolean(range.from || range.to);
class DashboardRepository {
    static employeeSummary(employeeWhere) {
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.employee.count({ where: employeeWhere }),
            prisma_1.prisma.employee.count({
                where: { ...employeeWhere, status: "ACTIVE" },
            }),
            prisma_1.prisma.employee.count({
                where: { ...employeeWhere, status: "INACTIVE" },
            }),
            prisma_1.prisma.employee.count({
                where: { ...employeeWhere, salaryType: client_1.SalaryType.WEEKLY },
            }),
            prisma_1.prisma.employee.count({
                where: { ...employeeWhere, salaryType: client_1.SalaryType.MONTHLY },
            }),
        ]);
    }
    static payrollSummary(employeeWhere, range) {
        const where = {
            employee: employeeWhere,
            ...(hasDateRange(range) && {
                periodStart: {
                    ...(range.from && { gte: range.from }),
                },
                periodEnd: {
                    ...(range.to && { lte: range.to }),
                },
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.groupBy({
                by: ["status"],
                where,
                _count: true,
            }),
            prisma_1.prisma.payroll.aggregate({
                where,
                _sum: {
                    finalSalary: true,
                    totalDeduction: true,
                    advanceDeduction: true,
                },
            }),
            prisma_1.prisma.payrollCarryForward.aggregate({
                where: {
                    employee: employeeWhere,
                    status: {
                        in: ["PENDING", "PARTIALLY_DEDUCTED"],
                    },
                },
                _sum: {
                    remainingAmount: true,
                },
            }),
            prisma_1.prisma.payroll.findMany({
                where,
                select: {
                    attendanceBreakdown: true,
                },
            }),
        ]);
    }
    static advanceSummary(employeeWhere, range) {
        const where = {
            employee: employeeWhere,
            ...(hasDateRange(range) && {
                date: dateRange(range.from, range.to),
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.advancePayment.count({
                where: { ...where, settlementStatus: "SETTLED" },
            }),
            prisma_1.prisma.advancePayment.count({
                where: { ...where, settlementStatus: "UNSETTLED" },
            }),
            prisma_1.prisma.advancePayment.count({
                where: { ...where, settlementStatus: "PARTIALLY_SETTLED" },
            }),
            prisma_1.prisma.advancePayment.aggregate({
                where,
                _sum: {
                    amount: true,
                    remainingAmount: true,
                },
            }),
        ]);
    }
    static attendanceSummary(employeeWhere, range) {
        return prisma_1.prisma.attendance.groupBy({
            by: ["status"],
            where: {
                employee: employeeWhere,
                ...(hasDateRange(range) && {
                    date: dateRange(range.from, range.to),
                }),
            },
            _count: true,
        });
    }
    static approvalSummary(employeeWhere, range) {
        return prisma_1.prisma.attendanceRequest.groupBy({
            by: ["status"],
            where: {
                employee: employeeWhere,
                ...(hasDateRange(range) && {
                    attendanceDate: dateRange(range.from, range.to),
                }),
            },
            _count: true,
        });
    }
    static recentPayroll(params) {
        const where = {
            employee: {
                ...params.employeeWhere,
                ...(params.search && {
                    OR: [
                        {
                            name: {
                                contains: params.search,
                                mode: "insensitive",
                            },
                        },
                        {
                            employeeCode: {
                                contains: params.search,
                                mode: "insensitive",
                            },
                        },
                    ],
                }),
            },
            ...(hasDateRange(params.range) && {
                periodStart: {
                    ...(params.range.from && { gte: params.range.from }),
                },
                periodEnd: {
                    ...(params.range.to && { lte: params.range.to }),
                },
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.findMany({
                where,
                skip: params.skip,
                take: params.take,
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                            salaryType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.payroll.count({ where }),
        ]);
    }
    static async recentActivities(params) {
        const take = params.take;
        const employeeWhere = params.employeeWhere;
        const [payroll, attendance, advances, requests, salaryHistory, auditLogs, ledger, employees,] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.attendance.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.prisma.advancePayment.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.prisma.attendanceRequest.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.prisma.salaryHistory.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.prisma.auditLog.findMany({
                where: { user: { is: employeeWhere } },
                take,
                include: { user: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.ledgerEntry.findMany({
                where: { employee: employeeWhere },
                take,
                include: { employee: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.employee.findMany({
                where: employeeWhere,
                take,
                orderBy: { createdAt: "desc" },
            }),
        ]);
        const counts = await prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.attendance.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.advancePayment.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.attendanceRequest.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.salaryHistory.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.auditLog.count({ where: { user: { is: employeeWhere } } }),
            prisma_1.prisma.ledgerEntry.count({ where: { employee: employeeWhere } }),
            prisma_1.prisma.employee.count({ where: employeeWhere }),
        ]);
        return {
            records: {
                payroll,
                attendance,
                advances,
                requests,
                salaryHistory,
                auditLogs,
                ledger,
                employees,
            },
            total: counts.reduce((sum, count) => sum + count, 0),
        };
    }
    static analytics(employeeWhere, range) {
        const payrollWhere = {
            employee: employeeWhere,
            ...(hasDateRange(range) && {
                periodStart: {
                    ...(range.from && { gte: range.from }),
                },
                periodEnd: {
                    ...(range.to && { lte: range.to }),
                },
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.findMany({
                where: payrollWhere,
                select: {
                    periodStart: true,
                    status: true,
                    finalSalary: true,
                    totalDeduction: true,
                    advanceDeduction: true,
                },
            }),
            prisma_1.prisma.attendance.findMany({
                where: {
                    employee: employeeWhere,
                    ...(hasDateRange(range) && {
                        date: dateRange(range.from, range.to),
                    }),
                },
                select: {
                    date: true,
                    status: true,
                },
            }),
            prisma_1.prisma.advancePayment.findMany({
                where: {
                    employee: employeeWhere,
                    ...(hasDateRange(range) && {
                        date: dateRange(range.from, range.to),
                    }),
                },
                select: {
                    date: true,
                    amount: true,
                    settledAmount: true,
                    remainingAmount: true,
                },
            }),
        ]);
    }
}
exports.DashboardRepository = DashboardRepository;
exports.dashboardEnums = {
    AttendanceStatus: client_1.AttendanceStatus,
    PayrollStatus: client_1.PayrollStatus,
    RequestStatus: client_1.RequestStatus,
};
//# sourceMappingURL=dashboard.repository.js.map