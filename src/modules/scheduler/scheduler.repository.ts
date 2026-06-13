import { prisma } from "../../config/prisma";
import {
  AdvanceDeductionMode,
  EmployeeStatus,
  PayrollStatus,
  Prisma,
  Role,
  SalaryType,
  SchedulerRunItemStatus,
  SchedulerRunStatus,
} from "@prisma/client";
import { CacheService } from "../../utils/cache";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
const payrollEmployeeWhere = {
  status: EmployeeStatus.ACTIVE,
  role: {
    in: [Role.USER, Role.ADMIN],
  },
};

export type SchedulerTargetPeriod = {
  salaryType: SalaryType;
  periodStart: Date;
  periodEnd: Date;
};

export class SchedulerRepository {
  static getActiveEmployees() {
    return prisma.employee.findMany({
      where: {
        ...payrollEmployeeWhere,
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

  static countActiveEmployees(salaryTypes?: SalaryType[]) {
    return prisma.employee.count({
      where: {
        ...payrollEmployeeWhere,
        ...(salaryTypes?.length
          ? {
              salaryType: {
                in: salaryTypes,
              },
            }
          : {}),
      },
    });
  }

  static countPendingActiveEmployees(targetPeriods: SchedulerTargetPeriod[]) {
    return prisma.employee.count({
      where: {
        ...payrollEmployeeWhere,
        OR: targetPeriods.map((period) => ({
          salaryType: period.salaryType,
          payrolls: {
            none: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
            },
          },
        })),
      },
    });
  }

  static getPendingActiveEmployeesBatch(params: {
    take: number;
    cursor?: string;
    targetPeriods: SchedulerTargetPeriod[];
  }) {
    return prisma.employee.findMany({
      where: {
        ...payrollEmployeeWhere,
        ...(params.cursor ? { id: { gt: params.cursor } } : {}),
        OR: params.targetPeriods.map((period) => ({
          salaryType: period.salaryType,
          payrolls: {
            none: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
            },
          },
        })),
      },
      take: params.take,
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

  static getHandledActiveEmployeesBatch(params: {
    take: number;
    cursor?: string;
    targetPeriods: SchedulerTargetPeriod[];
  }) {
    return prisma.employee.findMany({
      where: {
        ...payrollEmployeeWhere,
        ...(params.cursor ? { id: { gt: params.cursor } } : {}),
        OR: params.targetPeriods.map((period) => ({
          salaryType: period.salaryType,
          payrolls: {
            some: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
            },
          },
        })),
      },
      take: params.take,
      select: {
        id: true,
        employeeCode: true,
        salaryType: true,
        payrolls: {
          where: {
            OR: params.targetPeriods.map((period) => ({
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
            })),
          },
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });
  }

  static async findManualAdvanceReminderEmployees(
    targetPeriods: SchedulerTargetPeriod[],
  ) {
    const result = [];

    for (const period of targetPeriods) {
      const employees = await prisma.employee.findMany({
        where: {
          ...payrollEmployeeWhere,
          salaryType: period.salaryType,
          advanceDeductionMode: AdvanceDeductionMode.MANUAL,
          advances: {
            some: {
              date: {
                lte: period.periodEnd,
              },
              isSettled: false,
              remainingAmount: {
                gt: 0,
              },
            },
          },
          advanceManualDeductions: {
            none: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
            },
          },
          payrolls: {
            none: {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              status: {
                in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
              },
            },
          },
        },
        select: {
          id: true,
          employeeCode: true,
          name: true,
          salaryType: true,
          advances: {
            where: {
              date: {
                lte: period.periodEnd,
              },
              isSettled: false,
              remainingAmount: {
                gt: 0,
              },
            },
            select: {
              id: true,
              remainingAmount: true,
              date: true,
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: {
          employeeCode: "asc",
        },
      });

      result.push(
        ...employees.map((employee) => ({
          ...employee,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        })),
      );
    }

    return result;
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
    if (employeeIds.length === 0) {
      return new Map<
        string,
        {
          id: string;
          employeeId: string;
          salaryAmount: Prisma.Decimal;
          effectiveFrom: Date;
        }
      >();
    }

    const salaryHistories = await prisma.$queryRaw<
      {
        id: string;
        employeeId: string;
        salaryAmount: Prisma.Decimal;
        effectiveFrom: Date;
      }[]
    >`
      SELECT DISTINCT ON ("employeeId")
        id,
        "employeeId",
        "salaryAmount",
        "effectiveFrom"
      FROM "SalaryHistory"
      WHERE "employeeId" IN (${Prisma.join(employeeIds)})
      ORDER BY "employeeId", "effectiveFrom" ASC
    `;

    const firstSalaryMap = new Map<string, (typeof salaryHistories)[number]>();

    for (const salary of salaryHistories) {
      if (!firstSalaryMap.has(salary.employeeId)) {
        firstSalaryMap.set(salary.employeeId, salary);
      }
    }

    return firstSalaryMap;
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

  static findActiveSinglePayrollRun(params: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return prisma.schedulerRun.findFirst({
      where: {
        name: "MANUAL_SINGLE_PAYROLL_GENERATION",
        status: {
          in: [SchedulerRunStatus.PENDING, SchedulerRunStatus.RUNNING],
        },
        AND: [
          {
            metadata: {
              path: ["employeeId"],
              equals: params.employeeId,
            },
          },
          {
            metadata: {
              path: ["periodStart"],
              equals: params.periodStart,
            },
          },
          {
            metadata: {
              path: ["periodEnd"],
              equals: params.periodEnd,
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static markStaleActiveRunsFailed(params: {
    staleBefore: Date;
    errorMessage: string;
  }) {
    return prisma.schedulerRun.updateMany({
      where: {
        status: {
          in: [SchedulerRunStatus.PENDING, SchedulerRunStatus.RUNNING],
        },
        updatedAt: {
          lt: params.staleBefore,
        },
      },
      data: {
        status: SchedulerRunStatus.FAILED,
        completedAt: new Date(),
        errorMessage: params.errorMessage,
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
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
