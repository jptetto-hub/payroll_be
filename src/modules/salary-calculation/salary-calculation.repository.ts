import { prisma } from "../../config/prisma";
import { PayrollStatus } from "@prisma/client";

export class SalaryCalculationRepository {
  static findEmployee(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        role: true,
        status: true,
        salaryType: true,
        joiningDate: true,
      },
    });
  }

  static getSalaryHistories(employeeId: string, periodEnd: Date) {
    return prisma.salaryHistory.findMany({
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

  static getAttendance(employeeId: string, periodStart: Date, periodEnd: Date) {
    return prisma.attendance.findMany({
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

  static findActivePayrollSnapshot(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart,
        periodEnd,
        status: {
          in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
        },
      },
      orderBy: {
        version: "desc",
      },
    });
  }

  static getAdvances(employeeId: string, periodStart: Date, periodEnd: Date) {
    return prisma.advancePayment.findMany({
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

  static async getAdvancesWithCancelledPayrollSnapshot(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const [advances, cancelledPayrolls] = await Promise.all([
      this.getAdvances(employeeId, periodStart, periodEnd),
      prisma.payroll.findMany({
        where: {
          employeeId,
          periodStart,
          periodEnd,
          status: PayrollStatus.CANCELLED,
        },
        select: {
          advanceBreakdown: true,
        },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      }),
    ]);
    const includedIds = new Set(advances.map((advance) => advance.id));

    const snapshotAdvancesById = new Map<string, any>();
    for (const payroll of cancelledPayrolls) {
      const payrollSnapshotAdvances =
        ((payroll.advanceBreakdown as any)?.advances as any[]) ?? [];

      for (const advance of payrollSnapshotAdvances) {
        if (advance?.id && !snapshotAdvancesById.has(advance.id)) {
          snapshotAdvancesById.set(advance.id, advance);
        }
      }
    }

    const snapshotAdvances = [...snapshotAdvancesById.values()];
    const missingSnapshotAdvances = snapshotAdvances.filter(
      (advance) => advance?.id && !includedIds.has(advance.id),
    );

    if (missingSnapshotAdvances.length === 0) {
      return advances;
    }

    const snapshotById = new Map(
      missingSnapshotAdvances.map((advance) => [advance.id, advance]),
    );
    const restoredRows = await prisma.advancePayment.findMany({
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
        const snapshot = snapshotById.get(advance.id) as any;
        const restoredRemainingAmount = Number(
          snapshot?.previousRemainingAmount ??
            snapshot?.deductedAmount ??
            snapshot?.remainingAmount ??
            advance.amount,
        );

        return {
          ...advance,
          remainingAmount: restoredRemainingAmount,
          settledAmount: Number(snapshot?.previousSettledAmount ?? 0),
          carryForwardAmount: Number(snapshot?.previousCarryForwardAmount ?? 0),
          settlementStatus:
            snapshot?.previousSettlementStatus ?? advance.settlementStatus,
          isSettled: snapshot?.previousIsSettled ?? false,
          __restoreBeforeSettlement: true,
          __previousSettledAmount: Number(snapshot?.previousSettledAmount ?? 0),
        };
      });

    return [...advances, ...restoredAdvances].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }
}
