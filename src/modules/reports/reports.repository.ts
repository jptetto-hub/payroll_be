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
    },
  },
};

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
