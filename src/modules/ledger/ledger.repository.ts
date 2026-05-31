import { LedgerType, PayrollStatus, Prisma } from "@prisma/client";
import { prisma, readPrisma } from "../../config/prisma";

type LedgerDateMode = "entry" | "cycle";

const ledgerEmployeeSelect = {
  id: true,
  employeeCode: true,
  name: true,
  salaryType: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

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
} satisfies Prisma.PayrollSelect;

const ledgerPayrollDetailSelect = {
  ...ledgerPayrollListSelect,
  salaryBreakdown: true,
  attendanceBreakdown: true,
  advanceBreakdown: true,
  overtimeBreakdown: true,
} satisfies Prisma.PayrollSelect;

const parseDateStart = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const parseDateEnd = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

const buildDateRange = (from?: string, to?: string) => {
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);

  if (!fromDate && !toDate) return undefined;

  return {
    ...(fromDate && { gte: fromDate }),
    ...(toDate && { lte: toDate }),
  };
};

export class LedgerRepository {
  static async getLastBalance(employeeId: string) {
    const last = await prisma.ledgerEntry.findFirst({
      where: { employeeId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    return last ? Number(last.balance) : 0;
  }

  static async getLastBalanceTx(tx: any, employeeId: string) {
    const last = await tx.ledgerEntry.findFirst({
      where: { employeeId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

    return last ? Number(last.balance) : 0;
  }

  static getLastEntryTx(tx: any, employeeId: string) {
    return tx.ledgerEntry.findFirst({
      where: { employeeId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        balance: true,
        createdAt: true,
      },
    });
  }

  static create(data: {
    employeeId: string;
    payrollId?: string;
    type: LedgerType;
    referenceId?: string;
    debit?: number;
    credit?: number;
    balance: number;
    date: Date;
    createdAt?: Date;
  }) {
    return prisma.ledgerEntry.create({
      data,
    });
  }

  static createManyTx(
    tx: any,
    data: {
      employeeId: string;
      payrollId?: string;
      type: LedgerType;
      referenceId?: string;
      debit?: number;
      credit?: number;
      balance: number;
      date: Date;
      createdAt?: Date;
    }[],
  ) {
    return tx.ledgerEntry.createMany({
      data,
    });
  }

  static createManyAndReturnTx(
    tx: any,
    data: {
      employeeId: string;
      payrollId?: string;
      type: LedgerType;
      referenceId?: string;
      debit?: number;
      credit?: number;
      balance: number;
      date: Date;
      createdAt?: Date;
    }[],
  ) {
    return tx.ledgerEntry.createManyAndReturn({
      data,
    });
  }

  static findAdvancesByIds(ids: string[]) {
    return readPrisma.advancePayment.findMany({
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

  static findPayrollsByIds(ids: string[]) {
    return readPrisma.payroll.findMany({
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

  static async getActiveStatementSummary(params: {
    employeeWhere: Prisma.EmployeeWhereInput;
    employeeId?: string;
    from?: string;
    to?: string;
    dateMode?: LedgerDateMode;
  }) {
    const dateRange = buildDateRange(params.from, params.to);
    const dateMode = params.dateMode ?? "entry";
    const employeeFilter = params.employeeId
      ? { employeeId: params.employeeId }
      : { employee: params.employeeWhere };
    const activePayrollWhere: Prisma.PayrollWhereInput = {
      ...employeeFilter,
      status: {
        in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
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
    const advanceDateWhere =
      dateMode === "cycle"
        ? {
            ...(dateRange?.gte && { cycleStartDate: { gte: dateRange.gte } }),
            ...(dateRange?.lte && { cycleEndDate: { lte: dateRange.lte } }),
          }
        : dateRange
          ? { date: dateRange }
          : {};

    const [
      advances,
      grossPayroll,
      roundedPayroll,
      excludedHistoricalEntries,
      activeAdjustmentCandidates,
    ] = await Promise.all([
      readPrisma.advancePayment.aggregate({
        where: {
          ...employeeFilter,
          ...advanceDateWhere,
        },
        _sum: {
          amount: true,
        },
      }),
      readPrisma.payroll.aggregate({
        where: activePayrollWhere,
        _sum: {
          grossSalary: true,
        },
        _count: {
          id: true,
        },
      }),
      readPrisma.payroll.aggregate({
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
      readPrisma.ledgerEntry.count({
        where: {
          ...employeeFilter,
          ...(dateMode === "entry" && dateRange && { date: dateRange }),
          OR: [
            {
              payroll: {
                status: {
                  in: [PayrollStatus.CANCELLED, PayrollStatus.SUPERSEDED],
                },
              },
            },
            {
              type: LedgerType.DEDUCTION,
            },
          ],
        },
      }),
      readPrisma.ledgerEntry.findMany({
        where: {
          ...employeeFilter,
          ...(dateMode === "entry" && dateRange && { date: dateRange }),
          type: LedgerType.ADJUSTMENT,
          payroll: {
            status: {
              in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
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
    const roundingAdjustment =
      Number(roundedPayroll._sum.finalSalary ?? 0) -
      Number(roundedPayroll._sum.rawFinalSalary ?? 0);
    const activeCredit = Math.round((grossEarned + roundingAdjustment) * 100) / 100;
    const activeNetMovement =
      Math.round((activeCredit - advancePaid) * 100) / 100;
    const legacyActiveAdjustments = activeAdjustmentCandidates.filter((entry) => {
      if (!entry.payroll) return false;

      const rawFinalSalary = Number(entry.payroll.rawFinalSalary);
      const finalSalary = Number(entry.payroll.finalSalary);
      const expectedRounding =
        rawFinalSalary < 0
          ? 0
          : Math.round((finalSalary - rawFinalSalary) * 100) / 100;
      const movement =
        Math.round((Number(entry.credit) - Number(entry.debit)) * 100) / 100;

      return Math.abs(movement - expectedRounding) > 0.01;
    }).length;

    return {
      activeCredit,
      advancePaid,
      activeNetMovement,
      activePayrollCount: grossPayroll._count.id,
      excludedHistoricalEntries:
        excludedHistoricalEntries + legacyActiveAdjustments,
      from: params.from ?? null,
      to: params.to ?? null,
    };
  }

  static listAll(params: {
    take: number;
    cursor?: string;
    employeeId?: string;
    employeeWhere?: Prisma.EmployeeWhereInput;
    payrollId?: string;
    type?: LedgerType;
    from?: string;
    to?: string;
    dateMode?: LedgerDateMode;
  }) {
    const dateRange = buildDateRange(params.from, params.to);
    const dateMode = params.dateMode ?? "entry";
    const cycleAdvanceIdsPromise =
      dateMode === "cycle" && dateRange
        ? readPrisma.advancePayment.findMany({
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
      const cycleDateWhere =
        dateMode === "cycle" && dateRange
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
                        type: LedgerType.ADVANCE,
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

    return readPrisma.ledgerEntry.findMany({
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

  static findById(id: string) {
    return readPrisma.ledgerEntry.findUnique({
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

  static listByEmployee(
    employeeId: string,
    params?: { skip: number; take: number; from?: string; to?: string },
  ) {
    return readPrisma.ledgerEntry.findMany({
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

  static countByEmployee(
    employeeId: string,
    params?: { from?: string; to?: string },
  ) {
    return readPrisma.ledgerEntry.count({
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

  static listByPayroll(
    payrollId: string,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.ledgerEntry.findMany({
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

  static countByPayroll(payrollId: string) {
    return readPrisma.ledgerEntry.count({
      where: { payrollId },
    });
  }

  static findEmployee(employeeId: string) {
    return readPrisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  static findPayroll(payrollId: string) {
    return readPrisma.payroll.findUnique({
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
