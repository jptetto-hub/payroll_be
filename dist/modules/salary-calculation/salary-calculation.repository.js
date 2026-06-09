"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryCalculationRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class SalaryCalculationRepository {
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
    static getSalaryHistories(employeeId, periodEnd) {
        return prisma_1.prisma.salaryHistory.findMany({
            where: {
                employeeId,
                effectiveFrom: {
                    lte: periodEnd,
                },
            },
            select: {
                id: true,
                employeeId: true,
                salaryAmount: true,
                effectiveFrom: true,
            },
            orderBy: {
                effectiveFrom: "asc",
            },
        });
    }
    static getAttendance(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.attendance.findMany({
            where: {
                employeeId,
                date: {
                    gte: periodStart,
                    lte: periodEnd,
                },
            },
            select: {
                id: true,
                employeeId: true,
                date: true,
                status: true,
                otHours: true,
                otStartTime: true,
                otEndTime: true,
                otManualOverride: true,
                otOverrideReason: true,
                otBreakdown: true,
            },
            orderBy: {
                date: "asc",
            },
        });
    }
    static findActivePayrollSnapshot(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart,
                periodEnd,
                status: {
                    in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
                },
            },
            orderBy: {
                version: "desc",
            },
        });
    }
    static getAdvances(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate: periodStart,
                cycleEndDate: periodEnd,
                isSettled: false,
            },
            select: {
                id: true,
                employeeId: true,
                amount: true,
                remainingAmount: true,
                settledAmount: true,
                carryForwardAmount: true,
                settlementStatus: true,
                isSettled: true,
                payCycleType: true,
                cycleStartDate: true,
                cycleEndDate: true,
                date: true,
            },
            orderBy: {
                date: "asc",
            },
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
            select: {
                id: true,
                employeeId: true,
                amount: true,
                remainingAmount: true,
                settledAmount: true,
                carryForwardAmount: true,
                settlementStatus: true,
                isSettled: true,
                payCycleType: true,
                cycleStartDate: true,
                cycleEndDate: true,
                date: true,
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
    static getUnprocessedEarlierAdvances(employeeId, periodStart) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleEndDate: {
                    lt: periodStart,
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
            orderBy: {
                cycleStartDate: "asc",
            },
        });
    }
    static async getAdvancesWithCancelledPayrollSnapshot(employeeId, periodStart, periodEnd) {
        const [advances, cancelledPayrolls] = await Promise.all([
            this.getAdvances(employeeId, periodStart, periodEnd),
            prisma_1.prisma.payroll.findMany({
                where: {
                    employeeId,
                    periodStart,
                    periodEnd,
                    status: client_1.PayrollStatus.CANCELLED,
                },
                select: {
                    advanceBreakdown: true,
                },
                orderBy: [{ version: "desc" }, { createdAt: "desc" }],
            }),
        ]);
        const includedIds = new Set(advances.map((advance) => advance.id));
        const snapshotAdvancesById = new Map();
        for (const payroll of cancelledPayrolls) {
            const payrollSnapshotAdvances = payroll.advanceBreakdown?.advances ?? [];
            for (const advance of payrollSnapshotAdvances) {
                if (advance?.id && !snapshotAdvancesById.has(advance.id)) {
                    snapshotAdvancesById.set(advance.id, advance);
                }
            }
        }
        const snapshotAdvances = [...snapshotAdvancesById.values()];
        const missingSnapshotAdvances = snapshotAdvances.filter((advance) => advance?.id && !includedIds.has(advance.id));
        if (missingSnapshotAdvances.length === 0) {
            return advances;
        }
        const snapshotById = new Map(missingSnapshotAdvances.map((advance) => [advance.id, advance]));
        const restoredRows = await prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                id: {
                    in: missingSnapshotAdvances.map((advance) => advance.id),
                },
                cycleStartDate: periodStart,
                cycleEndDate: periodEnd,
            },
            orderBy: {
                date: "asc",
            },
        });
        const restoredAdvances = restoredRows
            .filter((advance) => advance.isSettled || Number(advance.remainingAmount) <= 0)
            .map((advance) => {
            const snapshot = snapshotById.get(advance.id);
            const restoredRemainingAmount = Number(snapshot?.previousRemainingAmount ??
                snapshot?.deductedAmount ??
                snapshot?.remainingAmount ??
                advance.amount);
            return {
                ...advance,
                remainingAmount: restoredRemainingAmount,
                settledAmount: Number(snapshot?.previousSettledAmount ?? 0),
                carryForwardAmount: Number(snapshot?.previousCarryForwardAmount ?? 0),
                settlementStatus: snapshot?.previousSettlementStatus ?? advance.settlementStatus,
                isSettled: snapshot?.previousIsSettled ?? false,
                __restoreBeforeSettlement: true,
                __previousSettledAmount: Number(snapshot?.previousSettledAmount ?? 0),
            };
        });
        return [...advances, ...restoredAdvances].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
}
exports.SalaryCalculationRepository = SalaryCalculationRepository;
//# sourceMappingURL=salary-calculation.repository.js.map