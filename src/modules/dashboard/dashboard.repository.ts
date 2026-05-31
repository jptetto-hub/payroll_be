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
const hasEmployeeScope = (where: Prisma.EmployeeWhereInput) =>
  Object.keys(where).length > 0;

const employeeRelationWhere = (where: Prisma.EmployeeWhereInput) =>
  hasEmployeeScope(where) ? { employee: where } : {};

const employeeRecordWhere = (
  employeeWhere: Prisma.EmployeeWhereInput,
  employeeId?: string,
) =>
  employeeId ? { employeeId } : employeeRelationWhere(employeeWhere);

export class DashboardRepository {
  static recentCompactActivities(params: {
    employeeWhere: Prisma.EmployeeWhereInput;
    employeeId?: string;
    take: number;
  }) {
    if (params.employeeId) {
      return readPrisma.auditLog.findMany({
        where: {
          OR: [{ userId: params.employeeId }, { employeeId: params.employeeId }],
        },
        take: Math.min(params.take, 24),
        select: {
          id: true,
          module: true,
          action: true,
          description: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
            },
          },
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    const hasScope = hasEmployeeScope(params.employeeWhere);

    return readPrisma.auditLog.findMany({
      ...(hasScope && {
        where: {
          OR: [
            {
              user: {
                is: params.employeeWhere,
              },
            },
            {
              employee: {
                is: params.employeeWhere,
              },
            },
          ],
        },
      }),
      take: Math.min(params.take, 24),
      select: {
        id: true,
        module: true,
        action: true,
        description: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async employeeSummary(
    employeeWhere: Prisma.EmployeeWhereInput,
    employeeId?: string,
  ) {
    if (employeeId) {
      const employee = await readPrisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          status: true,
          salaryType: true,
        },
      });

      return [
        employee ? 1 : 0,
        employee?.status === "ACTIVE" ? 1 : 0,
        employee?.status === "INACTIVE" ? 1 : 0,
        employee?.salaryType === SalaryType.WEEKLY ? 1 : 0,
        employee?.salaryType === SalaryType.MONTHLY ? 1 : 0,
      ];
    }

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
    employeeId?: string,
  ) {
    const where = {
      ...employeeRecordWhere(employeeWhere, employeeId),
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
          ...employeeRecordWhere(employeeWhere, employeeId),
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
    employeeId?: string,
  ) {
    const where = {
      ...employeeRecordWhere(employeeWhere, employeeId),
      ...(hasDateRange(range) && {
        date: dateRange(range.from, range.to),
      }),
    };

    return Promise.all([
      readPrisma.advancePayment.groupBy({
        by: ["settlementStatus"],
        where,
        _count: true,
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
    employeeId?: string,
  ) {
    return readPrisma.attendance.groupBy({
      by: ["status"],
      where: {
        ...employeeRecordWhere(employeeWhere, employeeId),
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
    employeeId?: string,
  ) {
    return readPrisma.attendanceRequest.groupBy({
      by: ["status"],
      where: {
        ...employeeRecordWhere(employeeWhere, employeeId),
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
    employeeId?: string;
    range: DateRange;
    search?: string;
    includeTotal?: boolean;
  }) {
    const scopedEmployeeWhere = {
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
    };
    const where = {
      ...(params.employeeId
        ? { employeeId: params.employeeId }
        : hasEmployeeScope(scopedEmployeeWhere) && {
            employee: scopedEmployeeWhere,
          }),
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
        select: {
          id: true,
          employeeId: true,
          periodStart: true,
          periodEnd: true,
          finalSalary: true,
          status: true,
          createdAt: true,
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
      params.includeTotal
        ? readPrisma.payroll.count({ where })
        : Promise.resolve(0),
    ]);
  }

  static async recentActivities(params: {
    employeeWhere: Prisma.EmployeeWhereInput;
    take: number;
    includeTotal?: boolean;
  }) {
    const take = Math.min(params.take, 24);
    const employeeWhere = params.employeeWhere;
    const employeeSelect = {
      id: true,
      employeeCode: true,
      name: true,
      status: true,
      createdAt: true,
    } satisfies Prisma.EmployeeSelect;

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
        select: {
          id: true,
          isRecalculated: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          createdAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.attendance.findMany({
        where: { employee: employeeWhere },
        take,
        select: {
          id: true,
          date: true,
          status: true,
          updatedAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.advancePayment.findMany({
        where: { employee: employeeWhere },
        take,
        select: {
          id: true,
          date: true,
          settlementStatus: true,
          updatedAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.attendanceRequest.findMany({
        where: { employee: employeeWhere },
        take,
        select: {
          id: true,
          requestType: true,
          attendanceDate: true,
          status: true,
          updatedAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.salaryHistory.findMany({
        where: { employee: employeeWhere },
        take,
        select: {
          id: true,
          effectiveFrom: true,
          updatedAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { updatedAt: "desc" },
      }),
      readPrisma.auditLog.findMany({
        where: { user: { is: employeeWhere } },
        take,
        select: {
          id: true,
          module: true,
          action: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.ledgerEntry.findMany({
        where: { employee: employeeWhere },
        take,
        select: {
          id: true,
          type: true,
          date: true,
          createdAt: true,
          employee: { select: employeeSelect },
        },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.employee.findMany({
        where: employeeWhere,
        take,
        select: employeeSelect,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const total = params.includeTotal
      ? (
          await Promise.all([
            readPrisma.payroll.count({ where: { employee: employeeWhere } }),
            readPrisma.attendance.count({ where: { employee: employeeWhere } }),
            readPrisma.advancePayment.count({
              where: { employee: employeeWhere },
            }),
            readPrisma.attendanceRequest.count({
              where: { employee: employeeWhere },
            }),
            readPrisma.salaryHistory.count({
              where: { employee: employeeWhere },
            }),
            readPrisma.auditLog.count({
              where: { user: { is: employeeWhere } },
            }),
            readPrisma.ledgerEntry.count({
              where: { employee: employeeWhere },
            }),
            readPrisma.employee.count({ where: employeeWhere }),
          ])
        ).reduce((sum, count) => sum + count, 0)
      : payroll.length +
        attendance.length +
        advances.length +
        requests.length +
        salaryHistory.length +
        auditLogs.length +
        ledger.length +
        employees.length;

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
      total,
    };
  }

  static analytics(
    employeeWhere: Prisma.EmployeeWhereInput,
    range: DateRange,
    employeeId?: string,
  ) {
    const payrollWhere = {
      ...employeeRecordWhere(employeeWhere, employeeId),
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
        by: ["periodStart", "status"],
        where: payrollWhere,
        _count: true,
        _sum: {
          finalSalary: true,
          totalDeduction: true,
          advanceDeduction: true,
        },
      }),
      readPrisma.attendance.groupBy({
        by: ["date", "status"],
        where: {
          ...employeeRecordWhere(employeeWhere, employeeId),
          ...(hasDateRange(range) && {
            date: dateRange(range.from, range.to),
          }),
        },
        _count: true,
      }),
      readPrisma.advancePayment.groupBy({
        by: ["date"],
        where: {
          ...employeeRecordWhere(employeeWhere, employeeId),
          ...(hasDateRange(range) && {
            date: dateRange(range.from, range.to),
          }),
        },
        _sum: {
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
