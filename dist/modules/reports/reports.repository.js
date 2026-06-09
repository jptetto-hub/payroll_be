"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsRepository = void 0;
const prisma_1 = require("../../config/prisma");
const pagination_util_1 = require("../../shared/utils/pagination.util");
function paginationArgs(params) {
    return params.paginate === false
        ? {}
        : { skip: params.skip, take: params.take };
}
function dateRange(fromDate, toDate) {
    if (!fromDate && !toDate)
        return undefined;
    return {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
    };
}
function payrollDateWhere(params) {
    return {
        ...(params.fromDate && {
            periodStart: {
                gte: params.fromDate,
            },
        }),
        ...(params.toDate && {
            periodEnd: {
                lte: params.toDate,
            },
        }),
    };
}
function scopedDateWhere(employeeWhere, field, fromDate, toDate) {
    const where = {
        employee: employeeWhere,
    };
    const range = dateRange(fromDate, toDate);
    if (range) {
        where[field] = range;
    }
    return where;
}
const payrollSelect = {
    id: true,
    employeeId: true,
    periodStart: true,
    periodEnd: true,
    salaryType: true,
    grossSalary: true,
    standardSalary: true,
    otTotalHours: true,
    otHourlyRate: true,
    otEarnings: true,
    advanceDeduction: true,
    carryForwardApplied: true,
    totalDeduction: true,
    rawFinalSalary: true,
    finalSalary: true,
    carryForwardDeduction: true,
    advanceBreakdown: true,
    status: true,
    version: true,
    workingDays: true,
    presentDays: true,
    halfDays: true,
    absentDays: true,
    employee: {
        select: {
            employeeCode: true,
            name: true,
            phone: true,
            department: true,
            designation: true,
            salaryType: true,
            advanceDeductionMode: true,
        },
    },
};
class ReportsRepository {
    static async getPayrollSummaryReport(params) {
        const { from, to, salaryType, employeeId } = params;
        return prisma_1.readPrisma.$queryRaw `
      SELECT
        p."salaryType"::text AS "salaryType",
        COUNT(*) AS "payrollCount",
        COUNT(DISTINCT p."employeeId") AS "employeeCount",
        COALESCE(SUM(p."grossSalary"), 0) AS "grossSalaryTotal",
        COALESCE(SUM(p."advanceDeduction"), 0) AS "advanceDeductionTotal",
        COALESCE(SUM(p."finalSalary"), 0) AS "finalSalaryTotal"
      FROM "Payroll" p
      WHERE p."periodStart" >= ${from}
        AND p."periodEnd" <= ${to}
        AND p."status" != 'CANCELLED'
        AND (${salaryType ?? null}::text IS NULL OR p."salaryType"::text = ${salaryType ?? null})
        AND (${employeeId ?? null}::text IS NULL OR p."employeeId" = ${employeeId ?? null})
      GROUP BY p."salaryType"
      ORDER BY p."salaryType";
    `;
    }
    static async getEmployeePayrollReport(params) {
        const { from, to, employeeId, limit, cursor } = params;
        return prisma_1.readPrisma.$queryRaw `
      SELECT
        e.id AS "employeeId",
        e."employeeCode" AS "employeeCode",
        e.name AS "employeeName",
        e."salaryType"::text AS "salaryType",
        COUNT(p.id) AS "payrollCount",
        COALESCE(SUM(p."grossSalary"), 0) AS "grossSalaryTotal",
        COALESCE(SUM(p."advanceDeduction"), 0) AS "advanceDeductionTotal",
        COALESCE(SUM(p."finalSalary"), 0) AS "finalSalaryTotal"
      FROM "Employee" e
      INNER JOIN "Payroll" p ON p."employeeId" = e.id
      WHERE p."periodStart" >= ${from}
        AND p."periodEnd" <= ${to}
        AND p."status" != 'CANCELLED'
        AND (${employeeId ?? null}::text IS NULL OR e.id = ${employeeId ?? null})
        AND (${cursor ?? null}::text IS NULL OR e.id > ${cursor ?? null})
      GROUP BY e.id, e."employeeCode", e.name, e."salaryType"
      ORDER BY e.id ASC
      LIMIT ${limit + 1};
    `;
    }
    static async getLedgerSummaryReport(params) {
        const { from, to, employeeId } = params;
        return prisma_1.readPrisma.$queryRaw `
      SELECT
        l.type::text AS "type",
        COUNT(*) AS "entryCount",
        COALESCE(SUM(l.debit), 0) AS "totalDebit",
        COALESCE(SUM(l.credit), 0) AS "totalCredit",
        COALESCE(SUM(l.debit), 0) + COALESCE(SUM(l.credit), 0) AS "totalAmount"
      FROM "LedgerEntry" l
      WHERE l.date >= ${from}
        AND l.date <= ${to}
        AND (${employeeId ?? null}::text IS NULL OR l."employeeId" = ${employeeId ?? null})
      GROUP BY l.type
      ORDER BY l.type;
    `;
    }
    static async getAttendanceSummaryReport(params) {
        const { from, to, employeeId } = params;
        return prisma_1.readPrisma.$queryRaw `
      SELECT
        e.id AS "employeeId",
        e."employeeCode" AS "employeeCode",
        e.name AS "employeeName",
        COUNT(*) FILTER (WHERE a.status = 'PRESENT') AS "presentDays",
        COUNT(*) FILTER (WHERE a.status = 'ABSENT') AS "absentDays",
        COUNT(*) FILTER (WHERE a.status = 'HALF_DAY') AS "halfDays",
        COUNT(*) AS "totalMarkedDays",
        COALESCE(SUM(a."otHours"), 0) AS "totalOtHours"
      FROM "Attendance" a
      INNER JOIN "Employee" e ON e.id = a."employeeId"
      WHERE a.date >= ${from}
        AND a.date <= ${to}
        AND (${employeeId ?? null}::text IS NULL OR a."employeeId" = ${employeeId ?? null})
      GROUP BY e.id, e."employeeCode", e.name
      ORDER BY e."employeeCode" ASC;
    `;
    }
    static async getAdvanceOutstandingReport(params) {
        const { employeeId, salaryType } = params;
        return prisma_1.readPrisma.$queryRaw `
      SELECT
        e.id AS "employeeId",
        e."employeeCode" AS "employeeCode",
        e.name AS "employeeName",
        e."salaryType"::text AS "salaryType",
        COUNT(ap.id) AS "advanceCount",
        COALESCE(SUM(ap."remainingAmount"), 0) AS "totalRemainingAmount"
      FROM "AdvancePayment" ap
      INNER JOIN "Employee" e ON e.id = ap."employeeId"
      WHERE ap."isSettled" = false
        AND (${employeeId ?? null}::text IS NULL OR ap."employeeId" = ${employeeId ?? null})
        AND (${salaryType ?? null}::text IS NULL OR e."salaryType"::text = ${salaryType ?? null})
      GROUP BY e.id, e."employeeCode", e.name, e."salaryType"
      ORDER BY "totalRemainingAmount" DESC;
    `;
    }
    static async salaryReport(params) {
        const where = {
            employee: params.employeeWhere,
            ...payrollDateWhere(params),
        };
        const [total, data] = await Promise.all([
            prisma_1.readPrisma.payroll.count({ where }),
            prisma_1.readPrisma.payroll.findMany({
                where,
                select: payrollSelect,
                orderBy: { periodStart: "desc" },
                ...paginationArgs(params),
            }),
        ]);
        return {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, params.page, params.limit),
        };
    }
    static async attendanceReport(params) {
        const where = scopedDateWhere(params.employeeWhere, "date", params.fromDate, params.toDate);
        const [total, present, absent, halfDay, otAggregate, data] = await Promise.all([
            prisma_1.readPrisma.attendance.count({ where }),
            prisma_1.readPrisma.attendance.count({ where: { ...where, status: "PRESENT" } }),
            prisma_1.readPrisma.attendance.count({ where: { ...where, status: "ABSENT" } }),
            prisma_1.readPrisma.attendance.count({ where: { ...where, status: "HALF_DAY" } }),
            prisma_1.readPrisma.attendance.aggregate({
                where,
                _sum: {
                    otHours: true,
                },
            }),
            prisma_1.readPrisma.attendance.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            employeeCode: true,
                            name: true,
                            salaryType: true,
                        },
                    },
                },
                orderBy: { date: "desc" },
                ...paginationArgs(params),
            }),
        ]);
        return {
            data,
            summary: {
                totalRecords: total,
                present,
                absent,
                halfDay,
                totalOtHours: Number(otAggregate?._sum?.otHours ?? 0),
            },
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, params.page, params.limit),
        };
    }
    static async advanceReport(params) {
        const where = scopedDateWhere(params.employeeWhere, "date", params.fromDate, params.toDate);
        const [total, settledCount, aggregate, data] = await Promise.all([
            prisma_1.readPrisma.advancePayment.count({ where }),
            prisma_1.readPrisma.advancePayment.count({ where: { ...where, isSettled: true } }),
            prisma_1.readPrisma.advancePayment.aggregate({
                where,
                _sum: {
                    amount: true,
                    remainingAmount: true,
                    settledAmount: true,
                    carryForwardAmount: true,
                },
            }),
            prisma_1.readPrisma.advancePayment.findMany({
                where,
                select: {
                    id: true,
                    employeeId: true,
                    amount: true,
                    remainingAmount: true,
                    settledAmount: true,
                    carryForwardAmount: true,
                    settlementStatus: true,
                    lockedByPayrollId: true,
                    date: true,
                    payCycleType: true,
                    cycleStartDate: true,
                    cycleEndDate: true,
                    isSettled: true,
                    employee: {
                        select: {
                            employeeCode: true,
                            name: true,
                            salaryType: true,
                            advanceDeductionMode: true,
                        },
                    },
                },
                orderBy: { date: "desc" },
                ...paginationArgs(params),
            }),
        ]);
        return {
            data,
            summary: {
                totalAdvanceAmount: Number(aggregate._sum?.amount ?? 0),
                totalRemainingAmount: Number(aggregate._sum?.remainingAmount ?? 0),
                totalSettledAmount: Number(aggregate._sum?.settledAmount ?? 0),
                totalCarryForwardAmount: Number(aggregate._sum?.carryForwardAmount ?? 0),
                settledCount,
                unsettledCount: total - settledCount,
            },
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, params.page, params.limit),
        };
    }
    static async allInOneReport(params) {
        const where = {
            employee: params.employeeWhere,
            ...payrollDateWhere(params),
        };
        const [total, employees, aggregate, data] = await Promise.all([
            prisma_1.readPrisma.payroll.count({ where }),
            prisma_1.readPrisma.payroll.findMany({
                where,
                distinct: ["employeeId"],
                select: { employeeId: true },
            }),
            prisma_1.readPrisma.payroll.aggregate({
                where,
                _sum: {
                    grossSalary: true,
                    standardSalary: true,
                    otTotalHours: true,
                    otEarnings: true,
                    advanceDeduction: true,
                    carryForwardApplied: true,
                    totalDeduction: true,
                    rawFinalSalary: true,
                    finalSalary: true,
                    carryForwardDeduction: true,
                },
            }),
            prisma_1.readPrisma.payroll.findMany({
                where,
                select: payrollSelect,
                orderBy: { periodStart: "desc" },
                ...paginationArgs(params),
            }),
        ]);
        return {
            data,
            summary: {
                totalEmployees: employees.length,
                totalPayrollRecords: total,
                totalStandardSalary: Number(aggregate._sum.standardSalary ?? 0),
                totalOtHours: Number(aggregate._sum.otTotalHours ?? 0),
                totalOtEarnings: Number(aggregate._sum.otEarnings ?? 0),
                totalGrossSalary: Number(aggregate._sum.grossSalary ?? 0),
                totalAdvanceDeduction: Number(aggregate._sum.advanceDeduction ?? 0),
                totalCarryForwardApplied: Number(aggregate._sum.carryForwardApplied ?? 0),
                totalDeduction: Number(aggregate._sum.totalDeduction ?? 0),
                totalRawFinalSalary: Number(aggregate._sum.rawFinalSalary ?? 0),
                totalFinalSalary: Number(aggregate._sum.finalSalary ?? 0),
                totalCarryForwardDeduction: Number(aggregate._sum.carryForwardDeduction ?? 0),
            },
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, params.page, params.limit),
        };
    }
}
exports.ReportsRepository = ReportsRepository;
//# sourceMappingURL=reports.repository.js.map