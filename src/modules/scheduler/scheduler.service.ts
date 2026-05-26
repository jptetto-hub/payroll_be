import {
  SalaryType,
  SchedulerRunItemStatus,
  SchedulerRunStatus,
  WeekStartsOn,
} from "@prisma/client";
import { SchedulerRepository } from "./scheduler.repository";
import { PayrollService } from "../payroll/payroll.service";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { PerformanceTimer } from "../../utils/performanceTimer";
import { logger } from "../../config/logger";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await processor(item);
      }
    }),
  );
}

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const addMonths = (date: Date, months: number) => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
};

const startOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const endOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};

const getWeekStart = (date: Date, weekStartsOn: WeekStartsOn) => {
  const day = date.getUTCDay();
  const startDay = weekStartsOn === WeekStartsOn.MONDAY ? 1 : 0;
  const diff = (day - startDay + 7) % 7;

  return addDays(date, -diff);
};

const getWeeklyEndSaturday = (weekStart: Date) => {
  const diff = (6 - weekStart.getUTCDay() + 7) % 7;
  return addDays(weekStart, diff);
};

const todayUtc = () => {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

type SchedulerRunOptions = {
  runId?: string;
  triggeredByUserId?: string | undefined;
  mode?: "HTTP" | "BACKGROUND" | "CRON";
  salaryTypes?: SalaryType[];
};

const getLatestCompletedPeriod = (
  salaryType: SalaryType,
  currentDate: Date,
  weekStartsOn: WeekStartsOn,
) => {
  if (salaryType === SalaryType.MONTHLY) {
    let periodStart = startOfMonth(currentDate);
    let periodEnd = endOfMonth(periodStart);

    if (periodEnd > currentDate) {
      periodStart = addMonths(periodStart, -1);
      periodEnd = endOfMonth(periodStart);
    }

    return {
      periodStart,
      periodEnd,
    };
  }

  let periodStart = getWeekStart(currentDate, weekStartsOn);
  let periodEnd = getWeeklyEndSaturday(periodStart);

  if (periodEnd > currentDate) {
    periodStart = addDays(periodStart, -7);
    periodEnd = getWeeklyEndSaturday(periodStart);
  }

  return {
    periodStart,
    periodEnd,
  };
};

export class SchedulerService {
  static async recoverStaleRuns() {
    const staleMinutes = Number(
      process.env.SCHEDULER_STALE_RUN_MINUTES || 60,
    );
    const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);
    const message = `Marked failed automatically because the scheduler recorded no progress for ${staleMinutes} minutes. Start a new run to retry the current payroll cycle.`;
    const result = await SchedulerRepository.markStaleActiveRunsFailed({
      staleBefore,
      errorMessage: message,
    });

    if (result.count > 0) {
      logger.warn(
        { count: result.count, staleMinutes },
        "Recovered stale payroll scheduler runs",
      );
    }

    return result.count;
  }

  static async runPayrollScheduler(
    triggeredBy: "CRON" | "MANUAL" = "CRON",
    options: SchedulerRunOptions = {},
  ) {
    const timer = new PerformanceTimer("SchedulerService.runPayrollScheduler");
    timer.checkpoint("start");

    const startedAt = new Date();
    const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE || 100);
    const EMPLOYEE_CONCURRENCY = Number(
      process.env.SCHEDULER_EMPLOYEE_CONCURRENCY || 1,
    );
    const STORE_ITEM_DETAILS =
      process.env.SCHEDULER_STORE_ITEM_DETAILS === "true" ||
      process.env.SCHEDULER_STORE_SUCCESS_ITEMS === "true";
    const MAX_RESULT_ITEMS = Number(
      process.env.SCHEDULER_MAX_RESULT_ITEMS || 1000,
    );
    const addResultItem = (items: any[], item: any) => {
      if (items.length < MAX_RESULT_ITEMS) {
        items.push(item);
      }
    };

    const run = options.runId
      ? { id: options.runId }
      : await SchedulerRepository.createRun({
          name: "PAYROLL_SCHEDULER",
          status: SchedulerRunStatus.RUNNING,
          startedAt,
          metadata: {
            triggeredBy,
            triggeredByUserId: options.triggeredByUserId,
            mode: options.mode ?? triggeredBy,
            salaryTypes: options.salaryTypes,
            periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
            startedAt,
          },
        });

    const result = {
      triggeredBy,
      salaryTypes: options.salaryTypes ?? [SalaryType.MONTHLY, SalaryType.WEEKLY],
      periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
      employeeConcurrency: EMPLOYEE_CONCURRENCY,
      storesItemDetails: STORE_ITEM_DETAILS,
      storesSuccessItemDetails: STORE_ITEM_DETAILS,
      pendingEmployeeCount: 0,
      currentCycleAlreadyHandledCount: 0,
      totalEmployees: 0,
      processedEmployees: 0,
      successCount: 0,
      skippedCount: 0,
      failureCount: 0,
      generated: [] as any[],
      skipped: [] as any[],
      failed: [] as any[],
    };

    try {
      result.totalEmployees = await SchedulerRepository.countActiveEmployees(
        options.salaryTypes,
      );
      timer.checkpoint("active employee count");

      await SchedulerRepository.updateRun(run.id, {
        status: SchedulerRunStatus.RUNNING,
        totalEmployees: result.totalEmployees,
        startedAt,
        metadata: {
          triggeredBy,
          triggeredByUserId: options.triggeredByUserId,
          mode: options.mode ?? triggeredBy,
          salaryTypes: options.salaryTypes,
          periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
          startedAt,
        },
      });
      timer.checkpoint("scheduler run initialized");

      const setting = await SchedulerRepository.getSystemSetting();
      const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;
      timer.checkpoint("system setting fetch");

      const currentDate = todayUtc();
      const targetPeriods = new Map(
        (options.salaryTypes?.length
          ? options.salaryTypes
          : [SalaryType.MONTHLY, SalaryType.WEEKLY]
        ).map((salaryType) => [
          salaryType,
          getLatestCompletedPeriod(salaryType, currentDate, weekStartsOn),
        ]),
      );
      const targetPeriodList = Array.from(targetPeriods.entries()).map(
        ([salaryType, period]) => ({
          salaryType,
          ...period,
        }),
      );
      const pendingEmployees =
        await SchedulerRepository.countPendingActiveEmployees(targetPeriodList);

      result.pendingEmployeeCount = pendingEmployees;
      result.currentCycleAlreadyHandledCount =
        result.totalEmployees - pendingEmployees;
      result.processedEmployees = result.currentCycleAlreadyHandledCount;
      result.skippedCount = result.currentCycleAlreadyHandledCount;

      await SchedulerRepository.updateRun(run.id, {
        processedEmployees: result.processedEmployees,
        skippedCount: result.skippedCount,
      });
      timer.checkpoint("current-cycle pending employee count");

      if (
        STORE_ITEM_DETAILS &&
        result.currentCycleAlreadyHandledCount > 0
      ) {
        let handledCursor: string | undefined;

        while (true) {
          const handledEmployees =
            await SchedulerRepository.getHandledActiveEmployeesBatch({
              take: BATCH_SIZE,
              ...(handledCursor ? { cursor: handledCursor } : {}),
              targetPeriods: targetPeriodList,
            });

          if (handledEmployees.length === 0) {
            break;
          }

          await SchedulerRepository.createRunItems(
            handledEmployees.map((employee) => {
              const period = targetPeriods.get(employee.salaryType)!;
              const payroll = employee.payrolls.find(
                (item) =>
                  formatDate(item.periodStart) ===
                    formatDate(period.periodStart) &&
                  formatDate(item.periodEnd) === formatDate(period.periodEnd),
              );

              return {
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
                status: SchedulerRunItemStatus.SKIPPED,
                reason: payroll
                  ? `Current payroll cycle already handled (${payroll.status})`
                  : "Current payroll cycle already handled",
                payrollId: payroll?.id,
              };
            }),
          );

          handledCursor = handledEmployees[handledEmployees.length - 1]?.id;
        }

        timer.checkpoint("handled employee detail rows stored");
      }

      let cursor: string | undefined;

      while (true) {
        const employees =
          await SchedulerRepository.getPendingActiveEmployeesBatch({
          take: BATCH_SIZE,
          ...(cursor ? { cursor } : {}),
          targetPeriods: targetPeriodList,
        });
        timer.checkpoint("employee batch fetch");

        if (employees.length === 0) {
          break;
        }

        const employeeIds = employees.map((employee) => employee.id);
        const firstSalaryMap =
          await SchedulerRepository.getFirstSalaryHistories(employeeIds);
        const schedulerItemsToCreate: {
          runId: string;
          employeeId?: string;
          employeeCode?: string;
          periodStart?: Date;
          periodEnd?: Date;
          status: SchedulerRunItemStatus;
          reason?: string;
          errorMessage?: string;
          payrollId?: string | undefined;
        }[] = [];
        timer.checkpoint("batch preload");

        await processWithConcurrency(
          employees,
          EMPLOYEE_CONCURRENCY,
          async (employee) => {
          try {
            const firstSalary = firstSalaryMap.get(employee.id);

            if (!firstSalary) {
              result.skippedCount++;
              addResultItem(result.skipped, {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                reason: "No salary history found",
              });
              schedulerItemsToCreate.push({
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                status: SchedulerRunItemStatus.SKIPPED,
                reason: "No salary history found",
              });
              return;
            }

            const currentPeriod = targetPeriods.get(employee.salaryType)!;

            if (
              employee.joiningDate > currentPeriod.periodEnd ||
              firstSalary.effectiveFrom > currentPeriod.periodEnd
            ) {
              result.skippedCount++;
              addResultItem(result.skipped, {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: formatDate(currentPeriod.periodStart),
                periodEnd: formatDate(currentPeriod.periodEnd),
                reason: "Employee was not eligible in the current payroll cycle",
              });
              schedulerItemsToCreate.push({
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: currentPeriod.periodStart,
                periodEnd: currentPeriod.periodEnd,
                status: SchedulerRunItemStatus.SKIPPED,
                reason: "Employee was not eligible in the current payroll cycle",
              });
              return;
            }

            const payroll = await PayrollService.generate(
              {
                employeeId: employee.id,
                periodStart: formatDate(currentPeriod.periodStart),
                periodEnd: formatDate(currentPeriod.periodEnd),
                createPayslip: false,
              },
              "SUPER_ADMIN" as any,
            );

            const payrollResult = payroll as any;
            const generatedPayrollId =
              payrollResult?.payroll?.id ?? payrollResult?.id;

            if (!generatedPayrollId) {
              throw new Error("Payroll generation did not return payroll id");
            }

            result.successCount++;
            addResultItem(result.generated, {
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              periodStart: formatDate(currentPeriod.periodStart),
              periodEnd: formatDate(currentPeriod.periodEnd),
              payrollId: generatedPayrollId,
            });
            if (STORE_ITEM_DETAILS) {
              schedulerItemsToCreate.push({
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: currentPeriod.periodStart,
                periodEnd: currentPeriod.periodEnd,
                status: SchedulerRunItemStatus.SUCCESS,
                payrollId: generatedPayrollId,
              });
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

            if (/payroll already|active payroll already/i.test(errorMessage)) {
              result.skippedCount++;
              addResultItem(result.skipped, {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                reason: "Current payroll cycle was already handled",
              });
              if (STORE_ITEM_DETAILS) {
                const period = targetPeriods.get(employee.salaryType)!;

                schedulerItemsToCreate.push({
                  runId: run.id,
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  periodStart: period.periodStart,
                  periodEnd: period.periodEnd,
                  status: SchedulerRunItemStatus.SKIPPED,
                  reason: "Current payroll cycle was already handled",
                });
              }
              return;
            }

            result.failureCount++;
            addResultItem(result.failed, {
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              error: errorMessage,
            });
            schedulerItemsToCreate.push({
              runId: run.id,
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              status: SchedulerRunItemStatus.FAILED,
              errorMessage,
            });
          } finally {
            result.processedEmployees++;
          }
        },
        );

        await SchedulerRepository.createRunItems(schedulerItemsToCreate);
        await SchedulerRepository.updateRun(run.id, {
          processedEmployees: result.processedEmployees,
          successCount: result.successCount,
          skippedCount: result.skippedCount,
          failedCount: result.failureCount,
        });

        cursor = employees[employees.length - 1]?.id;
        timer.checkpoint("batch processed");
      }

      await SchedulerRepository.updateRun(run.id, {
        completedAt: new Date(),
        status:
          result.failureCount > 0
            ? SchedulerRunStatus.PARTIAL_SUCCESS
            : SchedulerRunStatus.COMPLETED,
        processedEmployees: result.processedEmployees,
        successCount: result.successCount,
        skippedCount: result.skippedCount,
        failedCount: result.failureCount,
        metadata: result,
      });
      timer.checkpoint("scheduler run completed");
      timer.end();

      return result;
    } catch (error) {
      await SchedulerRepository.updateRun(run.id, {
        completedAt: new Date(),
        status: SchedulerRunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: result,
      });
      timer.checkpoint("scheduler run failed");
      timer.end();

      throw error;
    }
  }

  static async listRuns(query: any) {
    await this.recoverStaleRuns();
    const { page, limit, skip, take } = getPagination(query);

    const [runs, total] = await SchedulerRepository.listRuns({
      skip,
      take,
    });

    return {
      data: runs,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async getRunStatus(id: string) {
    await this.recoverStaleRuns();
    return SchedulerRepository.findRunById(id);
  }

  static async listRunItems(runId: string, query: any) {
    const run = await SchedulerRepository.findRunById(runId);

    if (!run) {
      return null;
    }

    const { page, limit, skip, take } = getPagination(query);
    const status = query.status
      ? (String(query.status) as SchedulerRunItemStatus)
      : undefined;

    const [items, total] = await SchedulerRepository.listRunItems({
      runId,
      skip,
      take,
      ...(status && { status }),
    });

    const metadata = run.metadata as any;

    if (
      status === SchedulerRunItemStatus.SUCCESS &&
      total === 0 &&
      Array.isArray(metadata?.generated) &&
      metadata.generated.length > 0
    ) {
      const generatedRows = metadata.generated
        .slice(skip, skip + take)
        .map((item: any, index: number) => ({
          id: `${runId}-generated-${skip + index}`,
          runId,
          employeeId: item.employeeId,
          employeeCode: item.employeeCode,
          periodStart: item.periodStart,
          periodEnd: item.periodEnd,
          status: SchedulerRunItemStatus.SUCCESS,
          payrollId: item.payrollId ?? null,
          reason: null,
          errorMessage: null,
          createdAt: run.completedAt ?? run.createdAt,
        }));

      return {
        data: generatedRows,
        pagination: buildPaginationMeta(
          metadata.generated.length,
          page,
          limit,
        ),
      };
    }

    return {
      data: items,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
