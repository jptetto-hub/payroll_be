import {
  DashboardSummaryType,
  EmployeeStatus,
  LedgerType,
  PayrollStatus,
  Prisma,
  RequestStatus,
} from "@prisma/client";
import { prisma, readPrisma } from "../../config/prisma";
import { AppError } from "../../shared/utils/app-error";
import { CacheService } from "../../utils/cache";
import { logger } from "../../config/logger";

const parseFromDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const parseToDate = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

type DashboardSummaryRange = {
  periodStart?: Date | undefined;
  periodEnd?: Date | undefined;
};

export const buildGlobalDashboardSummaryKey = (
  periodStart?: Date,
  periodEnd?: Date,
) =>
  `GLOBAL_${periodStart?.toISOString() || "ALL"}_${periodEnd?.toISOString() || "ALL"}`;

const buildDashboardCacheKey = (
  periodStart?: Date,
  periodEnd?: Date,
) =>
  CacheService.buildKey(
    "dashboard-summary",
    periodStart?.toISOString().slice(0, 10) || "all",
    periodEnd?.toISOString().slice(0, 10) || "all",
  );

export const parseDashboardSummaryRange = (
  query: any,
): DashboardSummaryRange => {
  const periodStart = parseFromDate(query.from as string | undefined);
  const periodEnd = parseToDate(query.to as string | undefined);

  if (periodStart && Number.isNaN(periodStart.getTime())) {
    throw new AppError("Invalid from date. Use YYYY-MM-DD", 400);
  }

  if (periodEnd && Number.isNaN(periodEnd.getTime())) {
    throw new AppError("Invalid to date. Use YYYY-MM-DD", 400);
  }

  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    throw new AppError("Both from and to dates are required", 400);
  }

  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new AppError("from date cannot be greater than to date", 400);
  }

  return { periodStart, periodEnd };
};

export class DashboardSummaryService {
  private static emptyGlobalSummary(params: DashboardSummaryRange) {
    return {
      summaryKey: buildGlobalDashboardSummaryKey(
        params.periodStart,
        params.periodEnd,
      ),
      type: DashboardSummaryType.GLOBAL,
      employeeId: null,
      periodStart: params.periodStart ?? null,
      periodEnd: params.periodEnd ?? null,
      totalEmployees: 0,
      activeEmployees: 0,
      inactiveEmployees: 0,
      pendingAttendanceRequests: 0,
      approvedAttendanceRequests: 0,
      rejectedAttendanceRequests: 0,
      generatedPayrolls: 0,
      paidPayrolls: 0,
      cancelledPayrolls: 0,
      grossSalaryTotal: 0,
      advanceDeductionTotal: 0,
      finalSalaryTotal: 0,
      outstandingAdvanceTotal: 0,
      ledgerSalaryTotal: 0,
      ledgerAdvanceTotal: 0,
      ledgerDeductionTotal: 0,
      ledgerAdjustmentTotal: 0,
      calculatedAt: new Date(),
      isRefreshing: true,
    };
  }

  static async refreshGlobalSummary(params: {
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }) {
    const { periodStart, periodEnd } = params;
    const summaryKey = buildGlobalDashboardSummaryKey(periodStart, periodEnd);

    const payrollWhere: Prisma.PayrollWhereInput = {};
    const ledgerWhere: Prisma.LedgerEntryWhereInput = {};
    const attendanceRequestWhere: Prisma.AttendanceRequestWhereInput = {};

    if (periodStart && periodEnd) {
      payrollWhere.periodStart = {
        gte: periodStart,
      };
      payrollWhere.periodEnd = {
        lte: periodEnd,
      };
      ledgerWhere.date = {
        gte: periodStart,
        lte: periodEnd,
      };
      attendanceRequestWhere.attendanceDate = {
        gte: periodStart,
        lte: periodEnd,
      };
    }

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      pendingAttendanceRequests,
      approvedAttendanceRequests,
      rejectedAttendanceRequests,
      generatedPayrolls,
      paidPayrolls,
      cancelledPayrolls,
      payrollSalaryAgg,
      outstandingAdvanceAgg,
      salaryLedgerAgg,
      advanceLedgerAgg,
      deductionLedgerAgg,
      adjustmentDebitAgg,
      adjustmentCreditAgg,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({
        where: {
          status: EmployeeStatus.ACTIVE,
        },
      }),
      prisma.employee.count({
        where: {
          status: EmployeeStatus.INACTIVE,
        },
      }),
      prisma.attendanceRequest.count({
        where: {
          ...attendanceRequestWhere,
          status: RequestStatus.PENDING,
        },
      }),
      prisma.attendanceRequest.count({
        where: {
          ...attendanceRequestWhere,
          status: RequestStatus.APPROVED,
        },
      }),
      prisma.attendanceRequest.count({
        where: {
          ...attendanceRequestWhere,
          status: RequestStatus.REJECTED,
        },
      }),
      prisma.payroll.count({
        where: {
          ...payrollWhere,
          status: PayrollStatus.GENERATED,
        },
      }),
      prisma.payroll.count({
        where: {
          ...payrollWhere,
          status: PayrollStatus.PAID,
        },
      }),
      prisma.payroll.count({
        where: {
          ...payrollWhere,
          status: PayrollStatus.CANCELLED,
        },
      }),
      prisma.payroll.aggregate({
        where: {
          ...payrollWhere,
          status: {
            not: PayrollStatus.CANCELLED,
          },
        },
        _sum: {
          grossSalary: true,
          advanceDeduction: true,
          finalSalary: true,
        },
      }),
      prisma.advancePayment.aggregate({
        where: {
          isSettled: false,
        },
        _sum: {
          remainingAmount: true,
        },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...ledgerWhere,
          type: LedgerType.SALARY,
        },
        _sum: {
          credit: true,
        },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...ledgerWhere,
          type: LedgerType.ADVANCE,
        },
        _sum: {
          debit: true,
        },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...ledgerWhere,
          type: LedgerType.DEDUCTION,
        },
        _sum: {
          debit: true,
        },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...ledgerWhere,
          type: LedgerType.ADJUSTMENT,
        },
        _sum: {
          debit: true,
        },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          ...ledgerWhere,
          type: LedgerType.ADJUSTMENT,
        },
        _sum: {
          credit: true,
        },
      }),
    ]);

    const summaryData = {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      pendingAttendanceRequests,
      approvedAttendanceRequests,
      rejectedAttendanceRequests,
      generatedPayrolls,
      paidPayrolls,
      cancelledPayrolls,
      grossSalaryTotal: payrollSalaryAgg._sum?.grossSalary || 0,
      advanceDeductionTotal: payrollSalaryAgg._sum?.advanceDeduction || 0,
      finalSalaryTotal: payrollSalaryAgg._sum?.finalSalary || 0,
      outstandingAdvanceTotal:
        outstandingAdvanceAgg._sum.remainingAmount || 0,
      ledgerSalaryTotal: salaryLedgerAgg._sum?.credit || 0,
      ledgerAdvanceTotal: advanceLedgerAgg._sum?.debit || 0,
      ledgerDeductionTotal: deductionLedgerAgg._sum?.debit || 0,
      ledgerAdjustmentTotal:
        Number(adjustmentDebitAgg._sum?.debit || 0) +
        Number(adjustmentCreditAgg._sum?.credit || 0),
      calculatedAt: new Date(),
    };

    const summary = await prisma.dashboardSummary.upsert({
      where: {
        summaryKey,
      },
      update: summaryData,
      create: {
        summaryKey,
        type: DashboardSummaryType.GLOBAL,
        employeeId: null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        ...summaryData,
      },
    });

    await CacheService.delByPattern("dashboard-summary:*");

    return summary;
  }

  static async getGlobalSummary(params: {
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }) {
    const cached = await CacheService.get<any>(
      buildDashboardCacheKey(params.periodStart, params.periodEnd),
    );

    if (cached) {
      return cached;
    }

    const summaryKey = buildGlobalDashboardSummaryKey(
      params.periodStart,
      params.periodEnd,
    );

    const summary = await readPrisma.dashboardSummary.findUnique({
      where: {
        summaryKey,
      },
    });

    if (summary) {
      await CacheService.set(
        buildDashboardCacheKey(params.periodStart, params.periodEnd),
        summary,
        60 * 2,
      );
    }

    return summary;
  }

  static async getOrRefreshGlobalSummary(params: {
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }) {
    const summary = await this.getGlobalSummary(params);

    if (summary) {
      return summary;
    }

    const latestSummary = await readPrisma.dashboardSummary.findFirst({
      where: {
        type: DashboardSummaryType.GLOBAL,
      },
      orderBy: {
        calculatedAt: "desc",
      },
    });

    void this.refreshGlobalSummary(params).catch((error) => {
      logger.error({ error }, "Dashboard summary background refresh failed");
    });

    return latestSummary
      ? {
          ...latestSummary,
          isRefreshing: true,
        }
      : this.emptyGlobalSummary(params);
  }
}
