import { Prisma } from "@prisma/client";
import { readPrisma } from "../../config/prisma";
import { buildPaginationMeta } from "../../shared/utils/pagination.util";

type ReportParams = {
  employeeWhere: Prisma.EmployeeWhereInput;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
  page: number;
  limit: number;
  skip: number;
  take: number;
  paginate?: boolean;
};

function paginationArgs(params: ReportParams) {
  return params.paginate === false
    ? {}
    : { skip: params.skip, take: params.take };
}

function dateRange(fromDate?: Date, toDate?: Date) {
  if (!fromDate && !toDate) return undefined;

  return {
    ...(fromDate && { gte: fromDate }),
    ...(toDate && { lte: toDate }),
  };
}

function payrollDateWhere(params: ReportParams) {
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

function scopedDateWhere(
  employeeWhere: Prisma.EmployeeWhereInput,
  field: "date",
  fromDate?: Date,
  toDate?: Date,
) {
  const where: any = {
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

const activePayrollStatuses = ["GENERATED", "PAID", "SUPERSEDED"] as const;

async function getOpeningAdvanceBalanceMap(
  employeeIds: string[],
  fromDate?: Date,
) {
  const uniqueEmployeeIds = [...new Set(employeeIds)].filter(Boolean);

  if (!fromDate || uniqueEmployeeIds.length === 0) {
    return new Map<string, number>();
  }

  const [advanceOpening, payrollDeductions] = await Promise.all([
    readPrisma.advancePayment.groupBy({
      by: ["employeeId"],
      where: {
        employeeId: {
          in: uniqueEmployeeIds,
        },
        date: {
          lt: fromDate,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    readPrisma.payroll.groupBy({
      by: ["employeeId"],
      where: {
        employeeId: {
          in: uniqueEmployeeIds,
        },
        periodEnd: {
          lt: fromDate,
        },
        status: {
          in: [...activePayrollStatuses] as any,
        },
      },
      _sum: {
        advanceDeduction: true,
        carryForwardApplied: true,
      },
    }),
  ]);

  const map = new Map<string, number>();

  for (const row of advanceOpening) {
    map.set(row.employeeId, Number(row._sum.amount ?? 0));
  }

  for (const row of payrollDeductions) {
    const opening = map.get(row.employeeId) ?? 0;
    const deducted =
      Number(row._sum.advanceDeduction ?? 0) +
      Number(row._sum.carryForwardApplied ?? 0);

    map.set(row.employeeId, Math.max(opening - deducted, 0));
  }

  return map;
}

function attachOpeningAdvanceBalance<T extends { employeeId: string }>(
  rows: T[],
  openingBalanceMap: Map<string, number>,
) {
  return rows.map((row) => ({
    ...row,
    openingAdvanceBalance: openingBalanceMap.get(row.employeeId) ?? 0,
  }));
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumBy<T>(items: T[] | undefined, read: (item: T) => number) {
  return (items ?? []).reduce((sum, item) => sum + read(item), 0);
}

function getOpeningAdvanceBalanceFromPayrollSnapshot(payroll: {
  advanceBreakdown?: unknown;
  advanceDeduction?: unknown;
  carryForwardApplied?: unknown;
}) {
  const breakdown = (payroll.advanceBreakdown as any) ?? {};
  const advances = Array.isArray(breakdown.advances)
    ? breakdown.advances
    : [];
  const pendingCarryForwards = Array.isArray(
    breakdown.carryForwardApplied?.pendingCarryForwards,
  )
    ? breakdown.carryForwardApplied.pendingCarryForwards
    : [];
  const manualOutstanding = toNumber(breakdown.manualOutstandingTotal);
  const advanceOutstanding =
    manualOutstanding > 0
      ? manualOutstanding
      : sumBy(advances, (advance: any) =>
          toNumber(
            advance.previousRemainingAmount ??
              advance.remainingAmount ??
              advance.amount,
          ),
        );
  const carryForwardOutstanding = sumBy(
    pendingCarryForwards,
    (carryForward: any) =>
      toNumber(carryForward.remainingAmount ?? carryForward.amount),
  );
  const snapshotOpening = advanceOutstanding + carryForwardOutstanding;
  const deductedThisPayroll =
    toNumber(payroll.advanceDeduction) + toNumber(payroll.carryForwardApplied);

  return Math.max(snapshotOpening - deductedThisPayroll, 0);
}

async function attachAdvanceCycleOpeningBalance<
  T extends {
    employeeId: string;
    cycleStartDate: Date;
    cycleEndDate: Date;
    amount?: unknown;
    remainingAmount?: unknown;
    settledAmount?: unknown;
  },
>(rows: T[]) {
  if (rows.length === 0) return rows;

  const cycleKeys = [
    ...new Map(
      rows.map((row) => [
        `${row.employeeId}_${row.cycleStartDate.toISOString()}_${row.cycleEndDate.toISOString()}`,
        row,
      ]),
    ).values(),
  ];
  const payrolls = await readPrisma.payroll.findMany({
    where: {
      OR: cycleKeys.map((row) => ({
        employeeId: row.employeeId,
        periodStart: row.cycleStartDate,
        periodEnd: row.cycleEndDate,
      })),
      status: {
        in: [...activePayrollStatuses] as any,
      },
    },
    select: {
      employeeId: true,
      periodStart: true,
      periodEnd: true,
      advanceBreakdown: true,
      advanceDeduction: true,
      carryForwardApplied: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const payrollMap = new Map(
    payrolls.map((payroll) => [
      `${payroll.employeeId}_${payroll.periodStart.toISOString()}_${payroll.periodEnd.toISOString()}`,
      payroll,
    ]),
  );

  return rows.map((row) => {
    const payroll = payrollMap.get(
      `${row.employeeId}_${row.cycleStartDate.toISOString()}_${row.cycleEndDate.toISOString()}`,
    );
    const fallbackOpening = Math.max(
      toNumber(row.amount),
      toNumber(row.remainingAmount) + toNumber(row.settledAmount),
      0,
    );

    return {
      ...row,
      openingAdvanceBalance: payroll
        ? getOpeningAdvanceBalanceFromPayrollSnapshot(payroll)
        : fallbackOpening,
    };
  });
}

function attachPayrollOpeningAdvanceBalance<T extends {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  advanceBreakdown?: unknown;
  advanceDeduction?: unknown;
  carryForwardApplied?: unknown;
}>(
  rows: T[],
  fallbackOpeningBalanceMap: Map<string, number>,
) {
  return rows.map((row) => {
    const breakdown = (row.advanceBreakdown as any) ?? {};
    const hasPayrollAdvanceSnapshot =
      Array.isArray(breakdown.advances) ||
      Array.isArray(breakdown.carryForwardApplied?.pendingCarryForwards) ||
      breakdown.manualOutstandingTotal !== undefined;
    const snapshotOpeningBalance =
      getOpeningAdvanceBalanceFromPayrollSnapshot(row);
    const received = sumBy(
      ((row as any).__periodAdvances ?? []) as any[],
      (advance) => toNumber(advance.amount),
    );

    return {
      ...row,
      advanceReceived: received,
      openingAdvanceBalance:
        hasPayrollAdvanceSnapshot
          ? snapshotOpeningBalance
          : (fallbackOpeningBalanceMap.get(row.employeeId) ?? 0),
    };
  });
}

async function attachPayrollPeriodAdvances<
  T extends {
    employeeId: string;
    periodStart: Date;
    periodEnd: Date;
  },
>(rows: T[]) {
  if (rows.length === 0) return rows;

  const employeeIds = [...new Set(rows.map((row) => row.employeeId))];
  const minStart = new Date(
    Math.min(...rows.map((row) => row.periodStart.getTime())),
  );
  const maxEnd = new Date(
    Math.max(...rows.map((row) => row.periodEnd.getTime())),
  );
  const advances = await readPrisma.advancePayment.findMany({
    where: {
      employeeId: {
        in: employeeIds,
      },
      date: {
        gte: minStart,
        lte: maxEnd,
      },
    },
    select: {
      employeeId: true,
      amount: true,
      date: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    __periodAdvances: advances.filter(
      (advance) =>
        advance.employeeId === row.employeeId &&
        advance.date >= row.periodStart &&
        advance.date <= row.periodEnd,
    ),
  }));
}

export class ReportsRepository {
  static async getPayrollSummaryReport(params: {
    from: Date;
    to: Date;
    salaryType?: "MONTHLY" | "WEEKLY";
    employeeId?: string;
  }) {
    const { from, to, salaryType, employeeId } = params;

    return readPrisma.$queryRaw<
      {
        salaryType: string;
        payrollCount: bigint;
        employeeCount: bigint;
        grossSalaryTotal: unknown;
        advanceDeductionTotal: unknown;
        finalSalaryTotal: unknown;
      }[]
    >`
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

  static async getEmployeePayrollReport(params: {
    from: Date;
    to: Date;
    employeeId?: string;
    limit: number;
    cursor?: string;
  }) {
    const { from, to, employeeId, limit, cursor } = params;

    return readPrisma.$queryRaw<
      {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        salaryType: string;
        payrollCount: bigint;
        grossSalaryTotal: unknown;
        advanceDeductionTotal: unknown;
        finalSalaryTotal: unknown;
      }[]
    >`
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

  static async getLedgerSummaryReport(params: {
    from: Date;
    to: Date;
    employeeId?: string;
  }) {
    const { from, to, employeeId } = params;

    return readPrisma.$queryRaw<
      {
        type: string;
        entryCount: bigint;
        totalDebit: unknown;
        totalCredit: unknown;
        totalAmount: unknown;
      }[]
    >`
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

  static async getAttendanceSummaryReport(params: {
    from: Date;
    to: Date;
    employeeId?: string;
  }) {
    const { from, to, employeeId } = params;

    return readPrisma.$queryRaw<
      {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        presentDays: bigint;
        absentDays: bigint;
        halfDays: bigint;
        totalMarkedDays: bigint;
        totalOtHours: unknown;
      }[]
    >`
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

  static async getAdvanceOutstandingReport(params: {
    employeeId?: string;
    salaryType?: "MONTHLY" | "WEEKLY";
  }) {
    const { employeeId, salaryType } = params;

    return readPrisma.$queryRaw<
      {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        salaryType: string;
        advanceCount: bigint;
        totalRemainingAmount: unknown;
      }[]
    >`
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

  static async salaryReport(params: ReportParams) {
    const where = {
      employee: params.employeeWhere,
      ...payrollDateWhere(params),
    };

    const [total, data] = await Promise.all([
      readPrisma.payroll.count({ where }),
      readPrisma.payroll.findMany({
        where,
        select: payrollSelect,
        orderBy: { periodStart: "desc" },
        ...paginationArgs(params),
      } as any),
    ]);

    return {
      data,
      pagination: buildPaginationMeta(total, params.page, params.limit),
    };
  }

  static async attendanceReport(params: ReportParams) {
    const where = scopedDateWhere(
      params.employeeWhere,
      "date",
      params.fromDate,
      params.toDate,
    );

    const [total, present, absent, halfDay, otAggregate, data] =
      await Promise.all([
      readPrisma.attendance.count({ where }),
      readPrisma.attendance.count({ where: { ...where, status: "PRESENT" } }),
      readPrisma.attendance.count({ where: { ...where, status: "ABSENT" } }),
      readPrisma.attendance.count({ where: { ...where, status: "HALF_DAY" } }),
        (readPrisma.attendance as any).aggregate({
        where,
        _sum: {
          otHours: true,
        },
      }),
        readPrisma.attendance.findMany({
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
        } as any),
      ]);

    return {
      data,
      summary: {
        totalRecords: total,
        present,
        absent,
        halfDay,
        totalOtHours: Number((otAggregate as any)?._sum?.otHours ?? 0),
      },
      pagination: buildPaginationMeta(total, params.page, params.limit),
    };
  }

  static async advanceReport(params: ReportParams) {
    const where = scopedDateWhere(
      params.employeeWhere,
      "date",
      params.fromDate,
      params.toDate,
    );

    const [total, settledCount, aggregate, data] = await Promise.all([
      readPrisma.advancePayment.count({ where }),
      readPrisma.advancePayment.count({ where: { ...where, isSettled: true } }),
      readPrisma.advancePayment.aggregate({
        where,
        _sum: {
          amount: true,
          remainingAmount: true,
          settledAmount: true,
          carryForwardAmount: true,
        },
      }),
      readPrisma.advancePayment.findMany({
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
      } as any),
    ]);
    const dataWithOpeningBalance = await attachAdvanceCycleOpeningBalance(data);

    return {
      data: dataWithOpeningBalance,
      summary: {
        totalAdvanceAmount: Number(aggregate._sum?.amount ?? 0),
        totalRemainingAmount: Number(aggregate._sum?.remainingAmount ?? 0),
        totalSettledAmount: Number(aggregate._sum?.settledAmount ?? 0),
        totalCarryForwardAmount: Number(
          aggregate._sum?.carryForwardAmount ?? 0,
        ),
        settledCount,
        unsettledCount: total - settledCount,
      },
      pagination: buildPaginationMeta(total, params.page, params.limit),
    };
  }

  static async allInOneReport(params: ReportParams) {
    const where = {
      employee: params.employeeWhere,
      ...payrollDateWhere(params),
    };

    const [total, employees, aggregate, data] = await Promise.all([
      readPrisma.payroll.count({ where }),
      readPrisma.payroll.findMany({
        where,
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      readPrisma.payroll.aggregate({
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
      readPrisma.payroll.findMany({
        where,
        select: payrollSelect,
        orderBy: { periodStart: "desc" },
        ...paginationArgs(params),
      } as any),
    ]);
    const dataWithPeriodAdvances = await attachPayrollPeriodAdvances(data);
    const fallbackOpeningBalanceMap = await getOpeningAdvanceBalanceMap(
      dataWithPeriodAdvances.map((item) => item.employeeId),
      params.fromDate,
    );

    return {
      data: attachPayrollOpeningAdvanceBalance(
        dataWithPeriodAdvances,
        fallbackOpeningBalanceMap,
      ),
      summary: {
        totalEmployees: employees.length,
        totalPayrollRecords: total,
        totalStandardSalary: Number(aggregate._sum.standardSalary ?? 0),
        totalOtHours: Number(aggregate._sum.otTotalHours ?? 0),
        totalOtEarnings: Number(aggregate._sum.otEarnings ?? 0),
        totalGrossSalary: Number(aggregate._sum.grossSalary ?? 0),
        totalAdvanceDeduction: Number(aggregate._sum.advanceDeduction ?? 0),
        totalCarryForwardApplied: Number(
          aggregate._sum.carryForwardApplied ?? 0,
        ),
        totalDeduction: Number(aggregate._sum.totalDeduction ?? 0),
        totalRawFinalSalary: Number(aggregate._sum.rawFinalSalary ?? 0),
        totalFinalSalary: Number(aggregate._sum.finalSalary ?? 0),
        totalCarryForwardDeduction: Number(
          aggregate._sum.carryForwardDeduction ?? 0,
        ),
      },
      pagination: buildPaginationMeta(total, params.page, params.limit),
    };
  }
}
