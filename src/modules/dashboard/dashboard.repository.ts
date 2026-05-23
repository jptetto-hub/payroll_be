import { readPrisma } from "../../config/prisma";
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
    return Promise.all([
      readPrisma.employee.count({ where: employeeWhere }),
      readPrisma.employee.count({
        where: { ...employeeWhere, status: "ACTIVE" },
      }),
      readPrisma.employee.count({
        where: { ...employeeWhere, status: "INACTIVE" },
      }),
      readPrisma.employee.count({
        where: { ...employeeWhere, salaryType: SalaryType.WEEKLY },
      }),
      readPrisma.employee.count({
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

    return Promise.all([
      readPrisma.payroll.groupBy({
        by: ["status"],
        where,
        _count: true,
      }),
      readPrisma.payroll.aggregate({
        where,
        _sum: {
          finalSalary: true,
          otTotalHours: true,
          otEarnings: true,
          totalDeduction: true,
          advanceDeduction: true,
        },
      }),
      readPrisma.payrollCarryForward.aggregate({
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
      readPrisma.payroll.findMany({
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

    return Promise.all([
      readPrisma.advancePayment.count({
        where: { ...where, settlementStatus: "SETTLED" },
      }),
      readPrisma.advancePayment.count({
        where: { ...where, settlementStatus: "UNSETTLED" },
      }),
      readPrisma.advancePayment.count({
        where: { ...where, settlementStatus: "PARTIALLY_SETTLED" },
      }),
      readPrisma.advancePayment.aggregate({
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
    return readPrisma.attendance.groupBy({
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
    return readPrisma.attendanceRequest.groupBy({
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

    return Promise.all([
      readPrisma.payroll.findMany({
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
      readPrisma.payroll.count({ where }),
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
    ] = await Promise.all([
      readPrisma.payroll.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.attendance.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.advancePayment.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.attendanceRequest.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.salaryHistory.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.auditLog.findMany({
        where: { user: { is: employeeWhere } },
        take,
        include: { user: true },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.ledgerEntry.findMany({
        where: { employee: employeeWhere },
        take,
        include: { employee: true },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.employee.findMany({
        where: employeeWhere,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const counts = await Promise.all([
      readPrisma.payroll.count({ where: { employee: employeeWhere } }),
      readPrisma.attendance.count({ where: { employee: employeeWhere } }),
      readPrisma.advancePayment.count({ where: { employee: employeeWhere } }),
      readPrisma.attendanceRequest.count({ where: { employee: employeeWhere } }),
      readPrisma.salaryHistory.count({ where: { employee: employeeWhere } }),
      readPrisma.auditLog.count({ where: { user: { is: employeeWhere } } }),
      readPrisma.ledgerEntry.count({ where: { employee: employeeWhere } }),
      readPrisma.employee.count({ where: employeeWhere }),
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

    return Promise.all([
      readPrisma.payroll.findMany({
        where: payrollWhere,
        select: {
          periodStart: true,
          status: true,
          finalSalary: true,
          totalDeduction: true,
          advanceDeduction: true,
        },
      }),
      readPrisma.attendance.findMany({
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
      readPrisma.advancePayment.findMany({
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
