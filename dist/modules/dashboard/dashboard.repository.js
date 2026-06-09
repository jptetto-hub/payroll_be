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
const hasEmployeeScope = (where) => Object.keys(where).length > 0;
const employeeRelationWhere = (where) => hasEmployeeScope(where) ? { employee: where } : {};
const employeeRecordWhere = (employeeWhere, employeeId) => employeeId ? { employeeId } : employeeRelationWhere(employeeWhere);
class DashboardRepository {
    static recentCompactActivities(params) {
        if (params.employeeId) {
            return prisma_1.readPrisma.auditLog.findMany({
                where: {
                    OR: [{ userId: params.employeeId }, { employeeId: params.employeeId }],
                },
                take: Math.min(params.take, 24),
                select: {
                    id: true,
                    module: true,
                    action: true,
                    description: true,
                    status: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                        },
                    },
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
        }
        const hasScope = hasEmployeeScope(params.employeeWhere);
        return prisma_1.readPrisma.auditLog.findMany({
            ...(hasScope && {
                where: {
                    OR: [
                        {
                            user: {
                                is: params.employeeWhere,
                            },
                        },
                        {
                            employee: {
                                is: params.employeeWhere,
                            },
                        },
                    ],
                },
            }),
            take: Math.min(params.take, 24),
            select: {
                id: true,
                module: true,
                action: true,
                description: true,
                status: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                    },
                },
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    static async employeeSummary(employeeWhere, employeeId) {
        if (employeeId) {
            const employee = await prisma_1.readPrisma.employee.findUnique({
                where: { id: employeeId },
                select: {
                    status: true,
                    salaryType: true,
                },
            });
            return [
                employee ? 1 : 0,
                employee?.status === "ACTIVE" ? 1 : 0,
                employee?.status === "INACTIVE" ? 1 : 0,
                employee?.salaryType === client_1.SalaryType.WEEKLY ? 1 : 0,
                employee?.salaryType === client_1.SalaryType.MONTHLY ? 1 : 0,
            ];
        }
        return Promise.all([
            prisma_1.readPrisma.employee.count({ where: employeeWhere }),
            prisma_1.readPrisma.employee.count({
                where: { ...employeeWhere, status: "ACTIVE" },
            }),
            prisma_1.readPrisma.employee.count({
                where: { ...employeeWhere, status: "INACTIVE" },
            }),
            prisma_1.readPrisma.employee.count({
                where: { ...employeeWhere, salaryType: client_1.SalaryType.WEEKLY },
            }),
            prisma_1.readPrisma.employee.count({
                where: { ...employeeWhere, salaryType: client_1.SalaryType.MONTHLY },
            }),
        ]);
    }
    static payrollSummary(employeeWhere, range, employeeId) {
        const where = {
            ...employeeRecordWhere(employeeWhere, employeeId),
            ...(hasDateRange(range) && {
                periodStart: {
                    ...(range.from && { gte: range.from }),
                },
                periodEnd: {
                    ...(range.to && { lte: range.to }),
                },
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.payroll.groupBy({
                by: ["status"],
                where,
                _count: true,
            }),
            prisma_1.readPrisma.payroll.aggregate({
                where,
                _sum: {
                    finalSalary: true,
                    otTotalHours: true,
                    otEarnings: true,
                    totalDeduction: true,
                    advanceDeduction: true,
                },
            }),
            prisma_1.readPrisma.payrollCarryForward.aggregate({
                where: {
                    ...employeeRecordWhere(employeeWhere, employeeId),
                    status: {
                        in: ["PENDING", "PARTIALLY_DEDUCTED"],
                    },
                },
                _sum: {
                    remainingAmount: true,
                },
            }),
            prisma_1.readPrisma.payroll.findMany({
                where,
                select: {
                    attendanceBreakdown: true,
                },
            }),
        ]);
    }
    static advanceSummary(employeeWhere, range, employeeId) {
        const where = {
            ...employeeRecordWhere(employeeWhere, employeeId),
            ...(hasDateRange(range) && {
                date: dateRange(range.from, range.to),
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.advancePayment.groupBy({
                by: ["settlementStatus"],
                where,
                _count: true,
            }),
            prisma_1.readPrisma.advancePayment.aggregate({
                where,
                _sum: {
                    amount: true,
                    remainingAmount: true,
                },
            }),
        ]);
    }
    static attendanceSummary(employeeWhere, range, employeeId) {
        return prisma_1.readPrisma.attendance.groupBy({
            by: ["status"],
            where: {
                ...employeeRecordWhere(employeeWhere, employeeId),
                ...(hasDateRange(range) && {
                    date: dateRange(range.from, range.to),
                }),
            },
            _count: true,
        });
    }
    static approvalSummary(employeeWhere, range, employeeId) {
        return prisma_1.readPrisma.attendanceRequest.groupBy({
            by: ["status"],
            where: {
                ...employeeRecordWhere(employeeWhere, employeeId),
                ...(hasDateRange(range) && {
                    attendanceDate: dateRange(range.from, range.to),
                }),
            },
            _count: true,
        });
    }
    static recentPayroll(params) {
        const scopedEmployeeWhere = {
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
        };
        const where = {
            ...(params.employeeId
                ? { employeeId: params.employeeId }
                : hasEmployeeScope(scopedEmployeeWhere) && {
                    employee: scopedEmployeeWhere,
                }),
            ...(hasDateRange(params.range) && {
                periodStart: {
                    ...(params.range.from && { gte: params.range.from }),
                },
                periodEnd: {
                    ...(params.range.to && { lte: params.range.to }),
                },
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.payroll.findMany({
                where,
                skip: params.skip,
                take: params.take,
                select: {
                    id: true,
                    employeeId: true,
                    periodStart: true,
                    periodEnd: true,
                    finalSalary: true,
                    status: true,
                    createdAt: true,
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
            params.includeTotal
                ? prisma_1.readPrisma.payroll.count({ where })
                : Promise.resolve(0),
        ]);
    }
    static async recentActivities(params) {
        const take = Math.min(params.take, 24);
        const employeeWhere = params.employeeWhere;
        const employeeSelect = {
            id: true,
            employeeCode: true,
            name: true,
            status: true,
            createdAt: true,
        };
        const [payroll, attendance, advances, requests, salaryHistory, auditLogs, ledger, employees,] = await Promise.all([
            prisma_1.readPrisma.payroll.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    isRecalculated: true,
                    periodStart: true,
                    periodEnd: true,
                    status: true,
                    createdAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.attendance.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    updatedAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.readPrisma.advancePayment.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    date: true,
                    settlementStatus: true,
                    updatedAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.readPrisma.attendanceRequest.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    requestType: true,
                    attendanceDate: true,
                    status: true,
                    updatedAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.readPrisma.salaryHistory.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    effectiveFrom: true,
                    updatedAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma_1.readPrisma.auditLog.findMany({
                where: { user: { is: employeeWhere } },
                take,
                select: {
                    id: true,
                    module: true,
                    action: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.ledgerEntry.findMany({
                where: { employee: employeeWhere },
                take,
                select: {
                    id: true,
                    type: true,
                    date: true,
                    createdAt: true,
                    employee: { select: employeeSelect },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.employee.findMany({
                where: employeeWhere,
                take,
                select: employeeSelect,
                orderBy: { createdAt: "desc" },
            }),
        ]);
        const total = params.includeTotal
            ? (await Promise.all([
                prisma_1.readPrisma.payroll.count({ where: { employee: employeeWhere } }),
                prisma_1.readPrisma.attendance.count({ where: { employee: employeeWhere } }),
                prisma_1.readPrisma.advancePayment.count({
                    where: { employee: employeeWhere },
                }),
                prisma_1.readPrisma.attendanceRequest.count({
                    where: { employee: employeeWhere },
                }),
                prisma_1.readPrisma.salaryHistory.count({
                    where: { employee: employeeWhere },
                }),
                prisma_1.readPrisma.auditLog.count({
                    where: { user: { is: employeeWhere } },
                }),
                prisma_1.readPrisma.ledgerEntry.count({
                    where: { employee: employeeWhere },
                }),
                prisma_1.readPrisma.employee.count({ where: employeeWhere }),
            ])).reduce((sum, count) => sum + count, 0)
            : payroll.length +
                attendance.length +
                advances.length +
                requests.length +
                salaryHistory.length +
                auditLogs.length +
                ledger.length +
                employees.length;
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
            total,
        };
    }
    static analytics(employeeWhere, range, employeeId) {
        const payrollWhere = {
            ...employeeRecordWhere(employeeWhere, employeeId),
            ...(hasDateRange(range) && {
                periodStart: {
                    ...(range.from && { gte: range.from }),
                },
                periodEnd: {
                    ...(range.to && { lte: range.to }),
                },
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.payroll.groupBy({
                by: ["periodStart", "status"],
                where: payrollWhere,
                _count: true,
                _sum: {
                    finalSalary: true,
                    totalDeduction: true,
                    advanceDeduction: true,
                },
            }),
            prisma_1.readPrisma.attendance.groupBy({
                by: ["date", "status"],
                where: {
                    ...employeeRecordWhere(employeeWhere, employeeId),
                    ...(hasDateRange(range) && {
                        date: dateRange(range.from, range.to),
                    }),
                },
                _count: true,
            }),
            prisma_1.readPrisma.advancePayment.groupBy({
                by: ["date"],
                where: {
                    ...employeeRecordWhere(employeeWhere, employeeId),
                    ...(hasDateRange(range) && {
                        date: dateRange(range.from, range.to),
                    }),
                },
                _sum: {
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