import { prisma, readPrisma } from "../../config/prisma";
import {
  AdvanceSettlementStatus,
  CarryForwardStatus,
  Prisma,
  SalaryType,
} from "@prisma/client";
import { CacheService } from "../../utils/cache";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;

export class AdvanceRepository {
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
        advanceDeductionMode: true,
        joiningDate: true,
      },
    });
  }

  static async getSystemSetting() {
    const cached = await CacheService.get<any>(SYSTEM_SETTINGS_CACHE_KEY);

    if (cached) {
      return cached;
    }

    const setting = await prisma.systemSetting.findFirst();

    await CacheService.set(
      SYSTEM_SETTINGS_CACHE_KEY,
      setting,
      SETTINGS_CACHE_TTL,
    );

    return setting;
  }

  static create(data: {
    employeeId: string;
    amount: number;
    date: Date;
    payCycleType: SalaryType;
    cycleStartDate: Date;
    cycleEndDate: Date;
    remainingAmount: number;
    isSettled: boolean;
    note?: string;
  }) {
    return prisma.advancePayment.create({
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

  static findById(id: string) {
    return prisma.advancePayment.findUnique({
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

  static listAll(params: {
    skip: number;
    take: number;
    employeeId?: string;
    employeeWhere?: Prisma.EmployeeWhereInput;
    isSettled?: boolean;
    from?: Date;
    to?: Date;
  }) {
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
      readPrisma.advancePayment.findMany({
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
      readPrisma.advancePayment.count({ where }),
    ]);
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
    filters?: {
      from?: Date;
      to?: Date;
      isSettled?: boolean;
    },
  ) {
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

    return readPrisma.advancePayment.findMany({
      where,
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { date: "desc" },
    });
  }

  static countByEmployee(
    employeeId: string,
    filters?: {
      from?: Date;
      to?: Date;
      isSettled?: boolean;
    },
  ) {
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

    return readPrisma.advancePayment.count({
      where,
    });
  }

  static listByCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return readPrisma.advancePayment.findMany({
      where: {
        employeeId,
        cycleStartDate,
        cycleEndDate,
      },
      orderBy: { date: "asc" },
    });
  }

  static findPayrollForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart: cycleStartDate,
        periodEnd: cycleEndDate,
      },
    });
  }

  static update(
    id: string,
    data: {
      amount?: number;
      remainingAmount?: number;
      date?: Date;
      cycleStartDate?: Date;
      cycleEndDate?: Date;
      note?: string;
    },
  ) {
    return prisma.advancePayment.update({
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

  static delete(id: string) {
    return prisma.advancePayment.delete({
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

  static getSalaryForDate(employeeId: string, date: Date) {
    return prisma.salaryHistory.findFirst({
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

  static getAdvancesForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
    excludeAdvanceId?: string,
  ) {
    return prisma.advancePayment.findMany({
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

  static getPendingCarryForwardsBeforeCycle(
    employeeId: string,
    cycleStartDate: Date,
  ) {
    return prisma.payrollCarryForward.findMany({
      where: {
        employeeId,
        cycleEndDate: {
          lt: cycleStartDate,
        },
        status: {
          in: [
            CarryForwardStatus.PENDING,
            CarryForwardStatus.PARTIALLY_DEDUCTED,
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

  static getUnprocessedEarlierAdvances(
    employeeId: string,
    cycleStartDate: Date,
  ) {
    return prisma.advancePayment.findMany({
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

  static getUnsettledAdvancesForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return prisma.advancePayment.findMany({
      where: {
        employeeId,
        cycleStartDate,
        cycleEndDate,
        isSettled: false,
      },
      orderBy: { date: "asc" },
    });
  }

  static getOutstandingAdvances(employeeId: string, periodEnd: Date) {
    return prisma.advancePayment.findMany({
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

  static getUnlockedManualDeductionsBefore(
    employeeId: string,
    periodStart: Date,
  ) {
    return prisma.advanceManualDeduction.findMany({
      where: {
        employeeId,
        periodEnd: {
          lt: periodStart,
        },
        lockedByPayrollId: null,
      },
      orderBy: [{ periodStart: "asc" }, { createdAt: "asc" }],
    });
  }

  static getAdvanceHistoryUntil(employeeId: string, periodEnd: Date) {
    return prisma.advancePayment.findMany({
      where: {
        employeeId,
        date: {
          lte: periodEnd,
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  }

  static getManualDeduction(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return prisma.advanceManualDeduction.findUnique({
      where: {
        employeeId_periodStart_periodEnd: {
          employeeId,
          periodStart,
          periodEnd,
        },
      },
    });
  }

  static getPayrollSnapshot(payrollId: string) {
    return prisma.payroll.findUnique({
      where: { id: payrollId },
      select: {
        id: true,
        grossSalary: true,
        advanceDeduction: true,
        advanceBreakdown: true,
      },
    });
  }

  static findManualDeductionById(id: string) {
    return prisma.advanceManualDeduction.findUnique({
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

  static deleteManualDeduction(id: string) {
    return prisma.advanceManualDeduction.delete({
      where: { id },
    });
  }

  static upsertManualDeduction(data: {
    employeeId: string;
    periodStart: Date;
    periodEnd: Date;
    salaryType: SalaryType;
    amount: number;
    note?: string;
    createdById?: string;
  }) {
    return prisma.advanceManualDeduction.upsert({
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

  static settleAdvances(ids: string[]) {
    return prisma.$transaction(async (tx) => {
      const advances = await tx.advancePayment.findMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      await Promise.all(
        advances.map((advance) =>
          tx.advancePayment.update({
            where: { id: advance.id },
            data: {
              settledAmount: advance.amount,
              remainingAmount: 0,
              carryForwardAmount: 0,
              settlementStatus: AdvanceSettlementStatus.SETTLED,
              isSettled: true,
            },
          }),
        ),
      );

      return {
        count: advances.length,
      };
    });
  }
}
