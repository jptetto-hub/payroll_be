import { prisma } from "../../config/prisma";
import {
  AttendanceStatus,
  PayrollStatus,
  Prisma,
  RequestStatus,
  SalaryType,
} from "@prisma/client";

type DateRange = {
  from?: Date | undefined;
  to?: Date | undefined;
};

const dateRange = (from?: Date, to?: Date) => ({
  ...(from && { gte: from }),
  ...(to && { lte: to }),
});

const hasDateRange = (range: DateRange) => Boolean(range.from || range.to);

export class DashboardRepository {
  static employeeSummary(employeeWhere: Prisma.EmployeeWhereInput) {
    return prisma.$transaction([
      prisma.employee.count({ where: employeeWhere }),
      prisma.employee.count({
        where: { ...employeeWhere, status: "ACTIVE" },
      }),
      prisma.employee.count({
        where: { ...employeeWhere, status: "INACTIVE" },
      }),
      prisma.employee.count({
        where: { ...employeeWhere, salaryType: SalaryType.WEEKLY },
      }),
      prisma.employee.count({
        where: { ...employeeWhere, salaryType: SalaryType.MONTHLY },
      }),
    ]);
  }

  static payrollSummary(
    employeeWhere: Prisma.EmployeeWhereInput,
    range: DateRange,
  ) {
    const where = {
      employee: employeeWhere,
      ...(hasDateRange(range) && {
        periodStart: {
          ...(range.from && { gte: range.from }),
        },
        periodEnd: {
          ...(range.to && { lte: range.to }),
        },
      }),
    };

    return prisma.$transaction([
      prisma.payroll.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      prisma.payroll.aggregate({
        where,
        _sum: {
          finalSalary: true,
          totalDeduction: true,
          advanceDeduction: true,
        },
      }),
      prisma.payrollCarryForward.aggregate({
        where: {
          employee: employeeWhere,
          status: {
            in: ["PENDING", "PARTIALLY_DEDUCTED"],
          },
        },
        _sum: {
          remainingAmount: true,
        },
      }),
      prisma.payroll.findMany({
        where,
        select: {
          attendanceBreakdown: true,
        },
      }),
    ]);
  }

  static advanceSummary(
    employeeWhere: Prisma.EmployeeWhereInput,
    range: DateRange,
  ) {
    const where = {
      employee: employeeWhere,
      ...(hasDateRange(range) && {
        date: dateRange(range.from, range.to),
      }),
    };

    return prisma.$transaction([
      prisma.advancePayment.count({
        where: { ...where, settlementStatus: "SETTLED" },
      }),
      prisma.advancePayment.count({
        where: { ...where, settlementStatus: "UNSETTLED" },
      }),
      prisma.advancePayment.count({
        where: { ...where, settlementStatus: "PARTIALLY_SETTLED" },
      }),
      prisma.advancePayment.aggregate({
        where,
        _sum: {
          amount: true,
          remainingAmount: true,
        },
      }),
    ]);
  }

  static attendanceSummary(
    employeeWhere: Prisma.EmployeeWhereInput,
    range: DateRange,
  ) {
    return prisma.attendance.groupBy({
      by: ["status"],
      where: {
        employee: employeeWhere,
        ...(hasDateRange(range) && {
          date: dateRange(range.from, range.to),
        }),
      },
      _count: true,
    });
  }

  static approvalSummary(
    employeeWhere: Prisma.EmployeeWhereInput,
    range: DateRange,
  ) {
    return prisma.attendanceRequest.groupBy({
      by: ["status"],
      where: {
        employee: employeeWhere,
        ...(hasDateRange(range) && {
          attendanceDate: dateRange(range.from, range.to),
        }),
      },
      _count: true,
    });
  }

  static recentPayroll(params: {
    skip: number;
    take: number;
    employeeWhere: Prisma.EmployeeWhereInput;
    range: DateRange;
    search?: string;
  }) {
    const where = {
      employee: {
        ...params.employeeWhere,
        ...(params.search && {
          OR: [
            {
              name: {
                contains: params.search,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
            {
              employeeCode: {
                contains: params.search,
                mode: "insensitive" as Prisma.QueryMode,
              },
            },
          ],
        }),
      },
      ...(hasDateRange(params.range) && {
        periodStart: {
          ...(params.range.from && { gte: params.range.from }),
        },
        periodEnd: {
          ...(params.range.to && { lte: params.range.to }),
        },
      }),
    };

    return prisma.$transaction([
      prisma.payroll.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              salaryType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payroll.count({ where }),
    ]);
  }

  static async recentActivities(params: {
    employeeWhere: Prisma.EmployeeWhereInput;
    take: number;
  }) {
    const take = params.take;
    const employeeWhere = params.employeeWhere;

    const [
      payroll,
      attendance,
      advances,
      requests,
      salaryHistory,
      auditLogs,
      ledger,
      employees,
    ] = await prisma.$transaction([
      prisma.payroll.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.attendance.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.advancePayment.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRequest.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.salaryHistory.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.auditLog.findMany({
        where: { user: { is: employeeWhere } },
        take,
        include: { user: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ledgerEntry.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employee.findMany({
        where: employeeWhere,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const counts = await prisma.$transaction([
      prisma.payroll.count({ where: { employee: employeeWhere } }),
      prisma.attendance.count({ where: { employee: employeeWhere } }),
      prisma.advancePayment.count({ where: { employee: employeeWhere } }),
      prisma.attendanceRequest.count({ where: { employee: employeeWhere } }),
      prisma.salaryHistory.count({ where: { employee: employeeWhere } }),
      prisma.auditLog.count({ where: { user: { is: employeeWhere } } }),
      prisma.ledgerEntry.count({ where: { employee: employeeWhere } }),
      prisma.employee.count({ where: employeeWhere }),
    ]);

    return {
      records: {
        payroll,
        attendance,
        advances,
        requests,
        salaryHistory,
        auditLogs,
        ledger,
        employees,
      },
      total: counts.reduce((sum, count) => sum + count, 0),
    };
  }

  static analytics(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange) {
    const payrollWhere = {
      employee: employeeWhere,
      ...(hasDateRange(range) && {
        periodStart: {
          ...(range.from && { gte: range.from }),
        },
        periodEnd: {
          ...(range.to && { lte: range.to }),
        },
      }),
    };

    return prisma.$transaction([
      prisma.payroll.findMany({
        where: payrollWhere,
        select: {
          periodStart: true,
          status: true,
          finalSalary: true,
          totalDeduction: true,
          advanceDeduction: true,
        },
      }),
      prisma.attendance.findMany({
        where: {
          employee: employeeWhere,
          ...(hasDateRange(range) && {
            date: dateRange(range.from, range.to),
          }),
        },
        select: {
          date: true,
          status: true,
        },
      }),
      prisma.advancePayment.findMany({
        where: {
          employee: employeeWhere,
          ...(hasDateRange(range) && {
            date: dateRange(range.from, range.to),
          }),
        },
        select: {
          date: true,
          amount: true,
          settledAmount: true,
          remainingAmount: true,
        },
      }),
    ]);
  }
}

export const dashboardEnums = {
  AttendanceStatus,
  PayrollStatus,
  RequestStatus,
};
