import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
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
  static async salaryReport(params: ReportParams) {
    const where = {
      employee: params.employeeWhere,
      ...payrollDateWhere(params),
    };

    const [total, data] = await prisma.$transaction([
      prisma.payroll.count({ where }),
      prisma.payroll.findMany({
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
      await prisma.$transaction([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, status: "PRESENT" } }),
      prisma.attendance.count({ where: { ...where, status: "ABSENT" } }),
      prisma.attendance.count({ where: { ...where, status: "HALF_DAY" } }),
        (prisma.attendance as any).aggregate({
        where,
        _sum: {
          otHours: true,
        },
      }),
        prisma.attendance.findMany({
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

    const [total, settledCount, aggregate, data] = await prisma.$transaction([
      prisma.advancePayment.count({ where }),
      prisma.advancePayment.count({ where: { ...where, isSettled: true } }),
      prisma.advancePayment.aggregate({
        where,
        _sum: {
          amount: true,
          remainingAmount: true,
          settledAmount: true,
          carryForwardAmount: true,
        },
      }),
      prisma.advancePayment.findMany({
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

    const [total, employees, aggregate, data] = await prisma.$transaction([
      prisma.payroll.count({ where }),
      prisma.payroll.findMany({
        where,
        distinct: ["employeeId"],
        select: { employeeId: true },
      }),
      prisma.payroll.aggregate({
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
      prisma.payroll.findMany({
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
