import {
  AttendanceStatus,
  PayrollStatus,
  Prisma,
  RequestStatus,
} from "@prisma/client";
import { DashboardRepository } from "./dashboard.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { AppError } from "../../shared/utils/app-error";

const parseFromDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const parseToDate = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

const parseRange = (query: any) => {
  const from = parseFromDate(query.from);
  const to = parseToDate(query.to);

  if (from && Number.isNaN(from.getTime())) {
    throw new AppError("Invalid from date. Use YYYY-MM-DD", 400);
  }

  if (to && Number.isNaN(to.getTime())) {
    throw new AppError("Invalid to date. Use YYYY-MM-DD", 400);
  }

  if (from && to && from > to) {
    throw new AppError("from date cannot be greater than to date", 400);
  }

  return { from, to };
};

const countBy = <T extends string>(
  rows: any[],
  key: string,
  value: T,
) => {
  const count = rows.find((row) => row[key] === value)?._count;
  return Number(count?._all ?? count ?? 0);
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key: string) => {
  const [year = 1970, month = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const getEmployeeScope = (query: any, user: any) =>
  resolveEmployeeScope({
    authUser: user,
    employeeId: query.employeeId as string | undefined,
  }).employeeWhere;

const employeeActivity = (employee: any) => ({
  employeeId: employee.id,
  employeeCode: employee.employeeCode,
  employeeName: employee.name,
});

export class DashboardService {
  static async summary(query: any, user: any) {
    const employeeWhere = getEmployeeScope(query, user);
    const range = parseRange(query);

    const [
      employeeCounts,
      payrollResult,
      advanceResult,
      attendanceRows,
      approvalRows,
    ] = await Promise.all([
      DashboardRepository.employeeSummary(employeeWhere),
      DashboardRepository.payrollSummary(employeeWhere, range),
      DashboardRepository.advanceSummary(employeeWhere, range),
      DashboardRepository.attendanceSummary(employeeWhere, range),
      DashboardRepository.approvalSummary(employeeWhere, range),
    ]);

    const [total, active, inactive, weekly, monthly] = employeeCounts;
    const [payrollRows, payrollSums, carryForwardSums, payrollAttendance] =
      payrollResult;
    const [settled, unsettled, partiallySettled, advanceSums] = advanceResult;

    const missing = payrollAttendance.reduce((sum, item) => {
      const breakdown = item.attendanceBreakdown as any;
      return sum + Number(breakdown?.missingDays ?? 0);
    }, 0);

    return {
      employees: {
        total,
        active,
        inactive,
        weekly,
        monthly,
      },
      payroll: {
        generated: countBy(payrollRows as any, "status", PayrollStatus.GENERATED),
        paid: countBy(payrollRows as any, "status", PayrollStatus.PAID),
        cancelled: countBy(
          payrollRows as any,
          "status",
          PayrollStatus.CANCELLED,
        ),
        superseded: countBy(
          payrollRows as any,
          "status",
          PayrollStatus.SUPERSEDED,
        ),
        totalSalary: Number(payrollSums._sum.finalSalary ?? 0),
        totalDeductions: Number(
          payrollSums._sum.totalDeduction ??
            payrollSums._sum.advanceDeduction ??
            0,
        ),
        carryForwardBalance: Number(
          carryForwardSums._sum.remainingAmount ?? 0,
        ),
      },
      advances: {
        settled,
        unsettled,
        partiallySettled,
        totalAdvanceAmount: Number(advanceSums._sum.amount ?? 0),
        remainingAmount: Number(advanceSums._sum.remainingAmount ?? 0),
      },
      attendance: {
        present: countBy(
          attendanceRows as any,
          "status",
          AttendanceStatus.PRESENT,
        ),
        absent: countBy(
          attendanceRows as any,
          "status",
          AttendanceStatus.ABSENT,
        ),
        halfDay: countBy(
          attendanceRows as any,
          "status",
          AttendanceStatus.HALF_DAY,
        ),
        missing,
      },
      approvals: {
        pending: countBy(approvalRows as any, "status", RequestStatus.PENDING),
        approved: countBy(
          approvalRows as any,
          "status",
          RequestStatus.APPROVED,
        ),
        rejected: countBy(
          approvalRows as any,
          "status",
          RequestStatus.REJECTED,
        ),
      },
    };
  }

  static async recentPayroll(query: any, user: any) {
    const { page, limit, skip, take } = getPagination(query);
    const employeeWhere = getEmployeeScope(query, user);
    const range = parseRange(query);
    const [records, total] = await DashboardRepository.recentPayroll({
      skip,
      take,
      employeeWhere,
      range,
      search: query.search,
    });

    return {
      data: records.map((payroll) => ({
        payrollId: payroll.id,
        employeeId: payroll.employeeId,
        employeeCode: payroll.employee.employeeCode,
        employeeName: payroll.employee.name,
        salaryType: payroll.employee.salaryType,
        periodStart: formatDate(payroll.periodStart),
        periodEnd: formatDate(payroll.periodEnd),
        finalSalary: Number(payroll.finalSalary),
        status: payroll.status,
        createdAt: payroll.createdAt,
      })),
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async recentActivities(query: any, user: any) {
    const { page, limit, skip, take } = getPagination(query);
    const employeeWhere = getEmployeeScope(query, user);
    const result = await DashboardRepository.recentActivities({
      employeeWhere,
      take: skip + take,
    });

    const activities = [
      ...result.records.payroll.map((item) => ({
        id: item.id,
        module: "PAYROLL",
        action: item.isRecalculated ? "PAYROLL_RECALCULATE" : "PAYROLL_GENERATE",
        ...employeeActivity(item.employee),
        summary: `Payroll generated for ${formatDate(item.periodStart)} to ${formatDate(item.periodEnd)}`,
        status: item.status,
        timestamp: item.createdAt,
      })),
      ...result.records.attendance.map((item) => ({
        id: item.id,
        module: "ATTENDANCE",
        action: "ATTENDANCE_UPDATE",
        ...employeeActivity(item.employee),
        summary: `Attendance marked ${item.status} for ${formatDate(item.date)}`,
        status: item.status,
        timestamp: item.updatedAt,
      })),
      ...result.records.advances.map((item) => ({
        id: item.id,
        module: "ADVANCE",
        action: "ADVANCE_UPDATE",
        ...employeeActivity(item.employee),
        summary: `Advance ${item.settlementStatus.toLowerCase()} for ${formatDate(item.date)}`,
        status: item.settlementStatus,
        timestamp: item.updatedAt,
      })),
      ...result.records.requests.map((item) => ({
        id: item.id,
        module: "ATTENDANCE_REQUEST",
        action: item.status,
        ...employeeActivity(item.employee),
        summary: `${item.requestType} attendance request for ${formatDate(item.attendanceDate)}`,
        status: item.status,
        timestamp: item.updatedAt,
      })),
      ...result.records.salaryHistory.map((item) => ({
        id: item.id,
        module: "SALARY_HISTORY",
        action: "SALARY_HISTORY_UPDATE",
        ...employeeActivity(item.employee),
        summary: `Salary history effective from ${formatDate(item.effectiveFrom)}`,
        status: item.employee.status,
        timestamp: item.updatedAt,
      })),
      ...result.records.auditLogs.map((item) => ({
        id: item.id,
        module: item.module,
        action: item.action,
        employeeId: item.user?.id ?? null,
        employeeCode: item.user?.employeeCode ?? null,
        employeeName: item.user?.name ?? null,
        summary: `${item.module} ${item.action}`,
        status: item.action,
        timestamp: item.createdAt,
      })),
      ...result.records.ledger.map((item) => ({
        id: item.id,
        module: "LEDGER",
        action: item.type,
        ...employeeActivity(item.employee),
        summary: `${item.type} ledger entry for ${formatDate(item.date)}`,
        status: item.type,
        timestamp: item.createdAt,
      })),
      ...result.records.employees.map((item) => ({
        id: item.id,
        module: "EMPLOYEE",
        action: "EMPLOYEE_CREATE",
        ...employeeActivity(item),
        summary: `Employee ${item.employeeCode} created`,
        status: item.status,
        timestamp: item.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      data: activities.slice(skip, skip + take),
      pagination: buildPaginationMeta(result.total, page, limit),
    };
  }

  static async analytics(query: any, user: any) {
    const employeeWhere = getEmployeeScope(query, user);
    const range = parseRange(query);
    const [payrollRows, attendanceRows, advanceRows] =
      await DashboardRepository.analytics(employeeWhere, range);

    const payrollTrend = new Map<string, any>();
    const attendanceTrend = new Map<string, any>();
    const advanceTrend = new Map<string, any>();
    const payrollStatusComparison = {
      generated: 0,
      paid: 0,
      cancelled: 0,
      superseded: 0,
    };

    for (const item of payrollRows) {
      const key = monthKey(item.periodStart);
      const row = payrollTrend.get(key) ?? {
        label: monthLabel(key),
        totalPayroll: 0,
        totalSalary: 0,
        totalDeductions: 0,
      };

      row.totalPayroll += 1;
      row.totalSalary += Number(item.finalSalary);
      row.totalDeductions += Number(
        item.totalDeduction ?? item.advanceDeduction ?? 0,
      );
      payrollTrend.set(key, row);

      if (item.status === PayrollStatus.GENERATED) {
        payrollStatusComparison.generated += 1;
      } else if (item.status === PayrollStatus.PAID) {
        payrollStatusComparison.paid += 1;
      } else if (item.status === PayrollStatus.CANCELLED) {
        payrollStatusComparison.cancelled += 1;
      } else if (item.status === PayrollStatus.SUPERSEDED) {
        payrollStatusComparison.superseded += 1;
      }
    }

    for (const item of attendanceRows) {
      const key = monthKey(item.date);
      const row = attendanceTrend.get(key) ?? {
        label: monthLabel(key),
        present: 0,
        absent: 0,
        halfDay: 0,
      };

      if (item.status === AttendanceStatus.PRESENT) row.present += 1;
      if (item.status === AttendanceStatus.ABSENT) row.absent += 1;
      if (item.status === AttendanceStatus.HALF_DAY) row.halfDay += 1;
      attendanceTrend.set(key, row);
    }

    for (const item of advanceRows) {
      const key = monthKey(item.date);
      const row = advanceTrend.get(key) ?? {
        label: monthLabel(key),
        totalAdvance: 0,
        settled: 0,
        remaining: 0,
      };

      row.totalAdvance += Number(item.amount);
      row.settled += Number(item.settledAmount);
      row.remaining += Number(item.remainingAmount);
      advanceTrend.set(key, row);
    }

    const byLabelDate = (a: any, b: any) =>
      new Date(a.label).getTime() - new Date(b.label).getTime();

    return {
      payrollTrend: [...payrollTrend.values()].sort(byLabelDate),
      attendanceTrend: [...attendanceTrend.values()].sort(byLabelDate),
      advanceTrend: [...advanceTrend.values()].sort(byLabelDate),
      payrollStatusComparison,
    };
  }
}
