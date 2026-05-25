import { prisma } from "../../config/prisma";
import {
  EmployeeStatus,
  Prisma,
  PayrollStatus,
  SchedulerRunItemStatus,
  SchedulerRunStatus,
} from "@prisma/client";
import { CacheService } from "../../utils/cache";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;

export class SchedulerRepository {
  static getActiveEmployees() {
    return prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        salaryType: true,
        joiningDate: true,
        role: true,
        status: true,
      },
      orderBy: {
        employeeCode: "asc",
      },
    });
  }

  static countActiveEmployees() {
    return prisma.employee.count({
      where: {
        status: EmployeeStatus.ACTIVE,
      },
    });
  }

  static getActiveEmployeesBatch(params: { take: number; cursor?: string }) {
    return prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
      },
      take: params.take,
      ...(params.cursor
        ? {
            skip: 1,
            cursor: {
              id: params.cursor,
            },
          }
        : {}),
      select: {
        id: true,
        employeeCode: true,
        name: true,
        salaryType: true,
        joiningDate: true,
        role: true,
        status: true,
      },
      orderBy: {
        id: "asc",
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

  static findPayroll(employeeId: string, periodStart: Date, periodEnd: Date) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart,
        periodEnd,
        status: {
          in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
        },
      },
    });
  }

  static getLatestPayroll(employeeId: string) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        status: {
          in: [
            PayrollStatus.GENERATED,
            PayrollStatus.PAID,
            PayrollStatus.SUPERSEDED,
          ],
        },
      },
      orderBy: {
        periodEnd: "desc",
      },
    });
  }

  static getFirstSalaryHistory(employeeId: string) {
    return prisma.salaryHistory.findFirst({
      where: {
        employeeId,
      },
      orderBy: {
        effectiveFrom: "asc",
      },
    });
  }

  static async getFirstSalaryHistories(employeeIds: string[]) {
    const salaryHistories = await prisma.salaryHistory.findMany({
      where: {
        employeeId: {
          in: employeeIds,
        },
      },
      orderBy: [
        {
          employeeId: "asc",
        },
        {
          effectiveFrom: "asc",
        },
      ],
      select: {
        id: true,
        employeeId: true,
        salaryAmount: true,
        effectiveFrom: true,
      },
    });

    const firstSalaryMap = new Map<string, (typeof salaryHistories)[number]>();

    for (const salary of salaryHistories) {
      if (!firstSalaryMap.has(salary.employeeId)) {
        firstSalaryMap.set(salary.employeeId, salary);
      }
    }

    return firstSalaryMap;
  }

  static async getLatestPayrolls(employeeIds: string[]) {
    if (employeeIds.length === 0) {
      return new Map<
        string,
        {
          id: string;
          employeeId: string;
          periodStart: Date;
          periodEnd: Date;
          status: PayrollStatus;
          version: number;
        }
      >();
    }

    const payrolls = await prisma.$queryRaw<
      {
        id: string;
        employeeId: string;
        periodStart: Date;
        periodEnd: Date;
        status: PayrollStatus;
        version: number;
      }[]
    >`
      SELECT DISTINCT ON ("employeeId")
        id,
        "employeeId",
        "periodStart",
        "periodEnd",
        status,
        version
      FROM "Payroll"
      WHERE "employeeId" IN (${Prisma.join(employeeIds)})
        AND status IN (
          ${PayrollStatus.GENERATED},
          ${PayrollStatus.PAID},
          ${PayrollStatus.SUPERSEDED}
        )
      ORDER BY "employeeId", "periodEnd" DESC
    `;

    const latestPayrollMap = new Map<string, (typeof payrolls)[number]>();

    for (const payroll of payrolls) {
      if (!latestPayrollMap.has(payroll.employeeId)) {
        latestPayrollMap.set(payroll.employeeId, payroll);
      }
    }

    return latestPayrollMap;
  }

  static async getPayrollsForEmployeesInDateRange(params: {
    employeeIds: string[];
    minPeriodStart: Date;
    maxPeriodEnd: Date;
  }) {
    const payrolls = await prisma.payroll.findMany({
      where: {
        employeeId: {
          in: params.employeeIds,
        },
        periodStart: {
          gte: params.minPeriodStart,
        },
        periodEnd: {
          lte: params.maxPeriodEnd,
        },
        status: {
          not: PayrollStatus.CANCELLED,
        },
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        version: true,
      },
    });

    const payrollMap = new Map<string, (typeof payrolls)[number]>();

    for (const payroll of payrolls) {
      const key = SchedulerRepository.getPayrollPeriodKey(
        payroll.employeeId,
        payroll.periodStart,
        payroll.periodEnd,
      );
      payrollMap.set(key, payroll);
    }

    return payrollMap;
  }

  static async getExistingPayrollsForBatch(params: {
    employeeIds: string[];
    maxPeriodEnd: Date;
  }) {
    const payrolls = await prisma.payroll.findMany({
      where: {
        employeeId: {
          in: params.employeeIds,
        },
        periodEnd: {
          lte: params.maxPeriodEnd,
        },
        status: {
          not: PayrollStatus.CANCELLED,
        },
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        version: true,
      },
    });

    const payrollMap = new Map<string, (typeof payrolls)[number]>();

    for (const payroll of payrolls) {
      const key = SchedulerRepository.getPayrollPeriodKey(
        payroll.employeeId,
        payroll.periodStart,
        payroll.periodEnd,
      );
      payrollMap.set(key, payroll);
    }

    return payrollMap;
  }

  static getPayrollPeriodKey(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return `${employeeId}_${periodStart.toISOString()}_${periodEnd.toISOString()}`;
  }

  static createRun(data: {
    name: string;
    status?: SchedulerRunStatus;
    startedAt?: Date;
    totalEmployees?: number;
    processedEmployees?: number;
    successCount?: number;
    skippedCount?: number;
    failedCount?: number;
    metadata?: any;
  }) {
    return prisma.schedulerRun.create({
      data,
    });
  }

  static findActiveRunByName(name: string) {
    return prisma.schedulerRun.findFirst({
      where: {
        name,
        status: {
          in: [SchedulerRunStatus.PENDING, SchedulerRunStatus.RUNNING],
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static updateRun(
    id: string,
    data: {
      status?: SchedulerRunStatus;
      totalEmployees?: number;
      processedEmployees?: number;
      successCount?: number;
      skippedCount?: number;
      failedCount?: number;
      startedAt?: Date;
      completedAt?: Date;
      errorMessage?: string;
      metadata?: any;
    },
  ) {
    return prisma.schedulerRun.update({
      where: { id },
      data,
    });
  }

  static createRunItem(data: {
    runId: string;
    employeeId?: string;
    employeeCode?: string;
    periodStart?: Date;
    periodEnd?: Date;
    status: SchedulerRunItemStatus;
    reason?: string;
    errorMessage?: string;
    payrollId?: string | undefined;
  }) {
    return prisma.schedulerRunItem.create({
      data: {
        runId: data.runId,
        employeeId: data.employeeId ?? null,
        employeeCode: data.employeeCode ?? null,
        periodStart: data.periodStart ?? null,
        periodEnd: data.periodEnd ?? null,
        status: data.status,
        reason: data.reason ?? null,
        errorMessage: data.errorMessage ?? null,
        payrollId: data.payrollId ?? null,
      },
    });
  }

  static createRunItems(
    items: {
      runId: string;
      employeeId?: string;
      employeeCode?: string;
      periodStart?: Date;
      periodEnd?: Date;
      status: SchedulerRunItemStatus;
      reason?: string;
      errorMessage?: string;
      payrollId?: string | undefined;
    }[],
  ) {
    if (items.length === 0) {
      return { count: 0 };
    }

    return prisma.schedulerRunItem.createMany({
      data: items.map((item) => ({
        runId: item.runId,
        employeeId: item.employeeId ?? null,
        employeeCode: item.employeeCode ?? null,
        periodStart: item.periodStart ?? null,
        periodEnd: item.periodEnd ?? null,
        status: item.status,
        reason: item.reason ?? null,
        errorMessage: item.errorMessage ?? null,
        payrollId: item.payrollId ?? null,
      })),
    });
  }

  static listRuns(params: { skip: number; take: number }) {
    return Promise.all([
      prisma.schedulerRun.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.schedulerRun.count(),
    ]);
  }

  static listRunItems(params: {
    runId: string;
    skip: number;
    take: number;
    status?: SchedulerRunItemStatus;
  }) {
    const where = {
      runId: params.runId,
      ...(params.status && { status: params.status }),
    };

    return Promise.all([
      prisma.schedulerRunItem.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          runId: true,
          employeeId: true,
          employeeCode: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          payrollId: true,
          reason: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.schedulerRunItem.count({ where }),
    ]);
  }

  static findRunById(id: string) {
    return prisma.schedulerRun.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        totalEmployees: true,
        processedEmployees: true,
        successCount: true,
        skippedCount: true,
        failedCount: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
