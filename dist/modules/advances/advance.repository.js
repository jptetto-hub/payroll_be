"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvanceRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const cache_1 = require("../../utils/cache");
const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
class AdvanceRepository {
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                role: true,
                status: true,
                salaryType: true,
                advanceDeductionMode: true,
                joiningDate: true,
            },
        });
    }
    static async getSystemSetting() {
        const cached = await cache_1.CacheService.get(SYSTEM_SETTINGS_CACHE_KEY);
        if (cached) {
            return cached;
        }
        const setting = await prisma_1.prisma.systemSetting.findFirst();
        await cache_1.CacheService.set(SYSTEM_SETTINGS_CACHE_KEY, setting, SETTINGS_CACHE_TTL);
        return setting;
    }
    static create(data) {
        return prisma_1.prisma.advancePayment.create({
            data,
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
            },
        });
    }
    static findById(id) {
        return prisma_1.prisma.advancePayment.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        role: true,
                        status: true,
                        salaryType: true,
                        advanceDeductionMode: true,
                        joiningDate: true,
                    },
                },
            },
        });
    }
    static listAll(params) {
        const where = {
            ...(params.employeeId
                ? { employeeId: params.employeeId }
                : params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.isSettled !== undefined && { isSettled: params.isSettled }),
            ...((params.from || params.to) && {
                date: {
                    ...(params.from && { gte: params.from }),
                    ...(params.to && { lte: params.to }),
                },
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.advancePayment.findMany({
                where,
                skip: params.skip,
                take: params.take,
                select: {
                    id: true,
                    employeeId: true,
                    amount: true,
                    remainingAmount: true,
                    settledAmount: true,
                    carryForwardAmount: true,
                    settlementStatus: true,
                    date: true,
                    payCycleType: true,
                    cycleStartDate: true,
                    cycleEndDate: true,
                    isSettled: true,
                    note: true,
                    lockedByPayrollId: true,
                    createdAt: true,
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                            phone: true,
                            department: true,
                            designation: true,
                            salaryType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.advancePayment.count({ where }),
        ]);
    }
    static listByEmployee(employeeId, pagination, filters) {
        const where = {
            employeeId,
            ...(filters?.isSettled !== undefined && {
                isSettled: filters.isSettled,
            }),
            ...((filters?.from || filters?.to) && {
                date: {
                    ...(filters.from && { gte: filters.from }),
                    ...(filters.to && { lte: filters.to }),
                },
            }),
        };
        return prisma_1.readPrisma.advancePayment.findMany({
            where,
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { date: "desc" },
        });
    }
    static countByEmployee(employeeId, filters) {
        const where = {
            employeeId,
            ...(filters?.isSettled !== undefined && {
                isSettled: filters.isSettled,
            }),
            ...((filters?.from || filters?.to) && {
                date: {
                    ...(filters.from && { gte: filters.from }),
                    ...(filters.to && { lte: filters.to }),
                },
            }),
        };
        return prisma_1.readPrisma.advancePayment.count({
            where,
        });
    }
    static listByCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.readPrisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
            },
            orderBy: { date: "asc" },
        });
    }
    static findPayrollForCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart: cycleStartDate,
                periodEnd: cycleEndDate,
            },
        });
    }
    static update(id, data) {
        return prisma_1.prisma.advancePayment.update({
            where: { id },
            data,
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
            },
        });
    }
    static delete(id) {
        return prisma_1.prisma.advancePayment.delete({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
            },
        });
    }
    static getSalaryForDate(employeeId, date) {
        return prisma_1.prisma.salaryHistory.findFirst({
            where: {
                employeeId,
                effectiveFrom: {
                    lte: date,
                },
            },
            orderBy: {
                effectiveFrom: "desc",
            },
        });
    }
    static getAdvancesForCycle(employeeId, cycleStartDate, cycleEndDate, excludeAdvanceId) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
                isSettled: false,
                ...(excludeAdvanceId && {
                    id: {
                        not: excludeAdvanceId,
                    },
                }),
            },
        });
    }
    static getPendingCarryForwardsBeforeCycle(employeeId, cycleStartDate) {
        return prisma_1.prisma.payrollCarryForward.findMany({
            where: {
                employeeId,
                cycleEndDate: {
                    lt: cycleStartDate,
                },
                status: {
                    in: [
                        client_1.CarryForwardStatus.PENDING,
                        client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                    ],
                },
                remainingAmount: {
                    gt: 0,
                },
            },
            select: {
                id: true,
                sourcePayrollId: true,
                cycleStartDate: true,
                cycleEndDate: true,
                remainingAmount: true,
            },
            orderBy: [{ cycleEndDate: "asc" }, { createdAt: "asc" }],
        });
    }
    static getUnprocessedEarlierAdvances(employeeId, cycleStartDate) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleEndDate: {
                    lt: cycleStartDate,
                },
                isSettled: false,
                remainingAmount: {
                    gt: 0,
                },
                lockedByPayrollId: null,
            },
            select: {
                id: true,
                cycleStartDate: true,
                cycleEndDate: true,
                remainingAmount: true,
            },
            orderBy: { cycleStartDate: "asc" },
        });
    }
    static getUnsettledAdvancesForCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
                isSettled: false,
            },
            orderBy: { date: "asc" },
        });
    }
    static getOutstandingAdvances(employeeId, periodEnd) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                date: {
                    lte: periodEnd,
                },
                isSettled: false,
                remainingAmount: {
                    gt: 0,
                },
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        });
    }
    static getAdvanceHistoryUntil(employeeId, periodEnd) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                date: {
                    lte: periodEnd,
                },
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        });
    }
    static getManualDeduction(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.advanceManualDeduction.findUnique({
            where: {
                employeeId_periodStart_periodEnd: {
                    employeeId,
                    periodStart,
                    periodEnd,
                },
            },
        });
    }
    static getPayrollSnapshot(payrollId) {
        return prisma_1.prisma.payroll.findUnique({
            where: { id: payrollId },
            select: {
                id: true,
                grossSalary: true,
                advanceDeduction: true,
                advanceBreakdown: true,
            },
        });
    }
    static findManualDeductionById(id) {
        return prisma_1.prisma.advanceManualDeduction.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });
    }
    static deleteManualDeduction(id) {
        return prisma_1.prisma.advanceManualDeduction.delete({
            where: { id },
        });
    }
    static upsertManualDeduction(data) {
        return prisma_1.prisma.advanceManualDeduction.upsert({
            where: {
                employeeId_periodStart_periodEnd: {
                    employeeId: data.employeeId,
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                },
            },
            create: data,
            update: {
                amount: data.amount,
                note: data.note,
            },
        });
    }
    static settleAdvances(ids) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const advances = await tx.advancePayment.findMany({
                where: {
                    id: {
                        in: ids,
                    },
                },
            });
            await Promise.all(advances.map((advance) => tx.advancePayment.update({
                where: { id: advance.id },
                data: {
                    settledAmount: advance.amount,
                    remainingAmount: 0,
                    carryForwardAmount: 0,
                    settlementStatus: client_1.AdvanceSettlementStatus.SETTLED,
                    isSettled: true,
                },
            })));
            return {
                count: advances.length,
            };
        });
    }
}
exports.AdvanceRepository = AdvanceRepository;
//# sourceMappingURL=advance.repository.js.map