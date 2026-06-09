"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const ledgerEmployeeSelect = {
    id: true,
    employeeCode: true,
    name: true,
    salaryType: true,
    role: true,
};
const ledgerPayrollListSelect = {
    id: true,
    periodStart: true,
    periodEnd: true,
    salaryType: true,
    standardSalary: true,
    grossSalary: true,
    otTotalHours: true,
    otHourlyRate: true,
    otEarnings: true,
    advanceDeduction: true,
    carryForwardApplied: true,
    totalDeduction: true,
    rawFinalSalary: true,
    finalSalary: true,
    carryForwardDeduction: true,
    workingDays: true,
    presentDays: true,
    absentDays: true,
    halfDays: true,
    status: true,
    version: true,
};
const ledgerPayrollDetailSelect = {
    ...ledgerPayrollListSelect,
    salaryBreakdown: true,
    attendanceBreakdown: true,
    advanceBreakdown: true,
    overtimeBreakdown: true,
};
const parseDateStart = (value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const parseDateEnd = (value) => value ? new Date(`${value}T23:59:59.999Z`) : undefined;
const buildDateRange = (from, to) => {
    const fromDate = parseDateStart(from);
    const toDate = parseDateEnd(to);
    if (!fromDate && !toDate)
        return undefined;
    return {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
    };
};
class LedgerRepository {
    static async getLastBalance(employeeId) {
        const last = await prisma_1.prisma.ledgerEntry.findFirst({
            where: { employeeId },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        });
        return last ? Number(last.balance) : 0;
    }
    static async getLastBalanceTx(tx, employeeId) {
        const last = await tx.ledgerEntry.findFirst({
            where: { employeeId },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        });
        return last ? Number(last.balance) : 0;
    }
    static getLastEntryTx(tx, employeeId) {
        return tx.ledgerEntry.findFirst({
            where: { employeeId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
                balance: true,
                createdAt: true,
            },
        });
    }
    static create(data) {
        return prisma_1.prisma.ledgerEntry.create({
            data,
        });
    }
    static createManyTx(tx, data) {
        return tx.ledgerEntry.createMany({
            data,
        });
    }
    static createManyAndReturnTx(tx, data) {
        return tx.ledgerEntry.createManyAndReturn({
            data,
        });
    }
    static findAdvancesByIds(ids) {
        return prisma_1.readPrisma.advancePayment.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                cycleStartDate: true,
                cycleEndDate: true,
                payCycleType: true,
                amount: true,
                remainingAmount: true,
                settledAmount: true,
                carryForwardAmount: true,
                settlementStatus: true,
                lockedByPayrollId: true,
            },
        });
    }
    static findPayrollsByIds(ids) {
        return prisma_1.readPrisma.payroll.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
            select: {
                id: true,
                employeeId: true,
                periodStart: true,
                periodEnd: true,
                salaryType: true,
                standardSalary: true,
                grossSalary: true,
                otTotalHours: true,
                otHourlyRate: true,
                otEarnings: true,
                advanceDeduction: true,
                carryForwardApplied: true,
                totalDeduction: true,
                rawFinalSalary: true,
                finalSalary: true,
                carryForwardDeduction: true,
                workingDays: true,
                presentDays: true,
                absentDays: true,
                halfDays: true,
                salaryBreakdown: true,
                attendanceBreakdown: true,
                advanceBreakdown: true,
                overtimeBreakdown: true,
                status: true,
                version: true,
            },
        });
    }
    static async getActiveStatementSummary(params) {
        const dateRange = buildDateRange(params.from, params.to);
        const dateMode = params.dateMode ?? "entry";
        const employeeFilter = params.employeeId
            ? { employeeId: params.employeeId }
            : { employee: params.employeeWhere };
        const activePayrollWhere = {
            ...employeeFilter,
            status: {
                in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
            },
            ...(dateRange &&
                (dateMode === "cycle"
                    ? {
                        periodStart: {
                            ...(dateRange.gte && { gte: dateRange.gte }),
                        },
                        periodEnd: {
                            ...(dateRange.lte && { lte: dateRange.lte }),
                        },
                    }
                    : { periodEnd: dateRange })),
        };
        const advanceDateWhere = dateMode === "cycle"
            ? {
                ...(dateRange?.gte && { cycleStartDate: { gte: dateRange.gte } }),
                ...(dateRange?.lte && { cycleEndDate: { lte: dateRange.lte } }),
            }
            : dateRange
                ? { date: dateRange }
                : {};
        const [advances, grossPayroll, roundedPayroll, excludedHistoricalEntries, activeAdjustmentCandidates,] = await Promise.all([
            prisma_1.readPrisma.advancePayment.aggregate({
                where: {
                    ...employeeFilter,
                    ...advanceDateWhere,
                },
                _sum: {
                    amount: true,
                },
            }),
            prisma_1.readPrisma.payroll.aggregate({
                where: activePayrollWhere,
                _sum: {
                    grossSalary: true,
                },
                _count: {
                    id: true,
                },
            }),
            prisma_1.readPrisma.payroll.aggregate({
                where: {
                    ...activePayrollWhere,
                    rawFinalSalary: {
                        gte: 0,
                    },
                },
                _sum: {
                    finalSalary: true,
                    rawFinalSalary: true,
                },
            }),
            prisma_1.readPrisma.ledgerEntry.count({
                where: {
                    ...employeeFilter,
                    ...(dateMode === "entry" && dateRange && { date: dateRange }),
                    OR: [
                        {
                            payroll: {
                                status: {
                                    in: [client_1.PayrollStatus.CANCELLED, client_1.PayrollStatus.SUPERSEDED],
                                },
                            },
                        },
                        {
                            type: client_1.LedgerType.DEDUCTION,
                        },
                    ],
                },
            }),
            prisma_1.readPrisma.ledgerEntry.findMany({
                where: {
                    ...employeeFilter,
                    ...(dateMode === "entry" && dateRange && { date: dateRange }),
                    type: client_1.LedgerType.ADJUSTMENT,
                    payroll: {
                        status: {
                            in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
                        },
                    },
                },
                select: {
                    debit: true,
                    credit: true,
                    payroll: {
                        select: {
                            rawFinalSalary: true,
                            finalSalary: true,
                        },
                    },
                },
            }),
        ]);
        const advancePaid = Number(advances._sum.amount ?? 0);
        const grossEarned = Number(grossPayroll._sum.grossSalary ?? 0);
        const roundingAdjustment = Number(roundedPayroll._sum.finalSalary ?? 0) -
            Number(roundedPayroll._sum.rawFinalSalary ?? 0);
        const activeCredit = Math.round((grossEarned + roundingAdjustment) * 100) / 100;
        const activeNetMovement = Math.round((activeCredit - advancePaid) * 100) / 100;
        const legacyActiveAdjustments = activeAdjustmentCandidates.filter((entry) => {
            if (!entry.payroll)
                return false;
            const rawFinalSalary = Number(entry.payroll.rawFinalSalary);
            const finalSalary = Number(entry.payroll.finalSalary);
            const expectedRounding = rawFinalSalary < 0
                ? 0
                : Math.round((finalSalary - rawFinalSalary) * 100) / 100;
            const movement = Math.round((Number(entry.credit) - Number(entry.debit)) * 100) / 100;
            return Math.abs(movement - expectedRounding) > 0.01;
        }).length;
        return {
            activeCredit,
            advancePaid,
            activeNetMovement,
            activePayrollCount: grossPayroll._count.id,
            excludedHistoricalEntries: excludedHistoricalEntries + legacyActiveAdjustments,
            from: params.from ?? null,
            to: params.to ?? null,
        };
    }
    static listAll(params) {
        const dateRange = buildDateRange(params.from, params.to);
        const dateMode = params.dateMode ?? "entry";
        const cycleAdvanceIdsPromise = dateMode === "cycle" && dateRange
            ? prisma_1.readPrisma.advancePayment.findMany({
                where: {
                    ...(params.employeeId
                        ? { employeeId: params.employeeId }
                        : params.employeeWhere && { employee: params.employeeWhere }),
                    ...(dateRange.gte && { cycleStartDate: { gte: dateRange.gte } }),
                    ...(dateRange.lte && { cycleEndDate: { lte: dateRange.lte } }),
                },
                select: {
                    id: true,
                },
            })
            : Promise.resolve([]);
        return cycleAdvanceIdsPromise.then((cycleAdvances) => {
            const cycleAdvanceIds = cycleAdvances.map((advance) => advance.id);
            const cycleDateWhere = dateMode === "cycle" && dateRange
                ? {
                    OR: [
                        {
                            payroll: {
                                ...(dateRange.gte && {
                                    periodStart: { gte: dateRange.gte },
                                }),
                                ...(dateRange.lte && {
                                    periodEnd: { lte: dateRange.lte },
                                }),
                            },
                        },
                        ...(cycleAdvanceIds.length > 0
                            ? [
                                {
                                    type: client_1.LedgerType.ADVANCE,
                                    referenceId: {
                                        in: cycleAdvanceIds,
                                    },
                                },
                            ]
                            : []),
                    ],
                }
                : {};
            const where = {
                ...(params.employeeId
                    ? { employeeId: params.employeeId }
                    : params.employeeWhere && { employee: params.employeeWhere }),
                ...(params.payrollId && { payrollId: params.payrollId }),
                ...(params.type && { type: params.type }),
                ...(dateMode === "entry" && dateRange && { date: dateRange }),
                ...cycleDateWhere,
            };
            return prisma_1.readPrisma.ledgerEntry.findMany({
                where,
                take: params.take,
                ...(params.cursor
                    ? {
                        skip: 1,
                        cursor: { id: params.cursor },
                    }
                    : {}),
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: {
                    id: true,
                    employeeId: true,
                    payrollId: true,
                    type: true,
                    referenceId: true,
                    debit: true,
                    credit: true,
                    balance: true,
                    date: true,
                    createdAt: true,
                    employee: {
                        select: ledgerEmployeeSelect,
                    },
                    payroll: {
                        select: ledgerPayrollListSelect,
                    },
                },
            });
        });
    }
    static findById(id) {
        return prisma_1.readPrisma.ledgerEntry.findUnique({
            where: { id },
            select: {
                id: true,
                employeeId: true,
                payrollId: true,
                type: true,
                referenceId: true,
                debit: true,
                credit: true,
                balance: true,
                date: true,
                createdAt: true,
                employee: {
                    select: ledgerEmployeeSelect,
                },
                payroll: {
                    select: ledgerPayrollDetailSelect,
                },
            },
        });
    }
    static listByEmployee(employeeId, params) {
        return prisma_1.readPrisma.ledgerEntry.findMany({
            where: {
                employeeId,
                ...((params?.from || params?.to) && {
                    date: {
                        ...(params.from && {
                            gte: new Date(`${params.from}T00:00:00.000Z`),
                        }),
                        ...(params.to && {
                            lte: new Date(`${params.to}T23:59:59.999Z`),
                        }),
                    },
                }),
            },
            select: {
                id: true,
                employeeId: true,
                payrollId: true,
                type: true,
                referenceId: true,
                debit: true,
                credit: true,
                balance: true,
                date: true,
                createdAt: true,
                employee: {
                    select: ledgerEmployeeSelect,
                },
                payroll: {
                    select: ledgerPayrollListSelect,
                },
            },
            ...(params && {
                skip: params.skip,
                take: params.take,
            }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
    }
    static countByEmployee(employeeId, params) {
        return prisma_1.readPrisma.ledgerEntry.count({
            where: {
                employeeId,
                ...((params?.from || params?.to) && {
                    date: {
                        ...(params.from && {
                            gte: new Date(`${params.from}T00:00:00.000Z`),
                        }),
                        ...(params.to && {
                            lte: new Date(`${params.to}T23:59:59.999Z`),
                        }),
                    },
                }),
            },
        });
    }
    static listByPayroll(payrollId, pagination) {
        return prisma_1.readPrisma.ledgerEntry.findMany({
            where: { payrollId },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        salaryType: true,
                    },
                },
                payroll: true,
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
    }
    static countByPayroll(payrollId) {
        return prisma_1.readPrisma.ledgerEntry.count({
            where: { payrollId },
        });
    }
    static findEmployee(employeeId) {
        return prisma_1.readPrisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                role: true,
                status: true,
            },
        });
    }
    static findPayroll(payrollId) {
        return prisma_1.readPrisma.payroll.findUnique({
            where: { id: payrollId },
            include: {
                employee: {
                    select: {
                        id: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });
    }
}
exports.LedgerRepository = LedgerRepository;
//# sourceMappingURL=ledger.repository.js.map