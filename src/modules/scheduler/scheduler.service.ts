import {
  PayrollStatus,
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

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

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

const isSameDate = (a: Date, b: Date) => formatDate(a) === formatDate(b);

type SchedulerRunOptions = {
  runId?: string;
  triggeredByUserId?: string | undefined;
  mode?: "HTTP" | "BACKGROUND" | "CRON";
};

const getNextPeriod = (
  salaryType: SalaryType,
  previousPeriodEnd: Date,
  weekStartsOn: WeekStartsOn,
) => {
  if (salaryType === SalaryType.MONTHLY) {
    const nextMonthStart = startOfMonth(addMonths(previousPeriodEnd, 1));

    return {
      periodStart: nextMonthStart,
      periodEnd: endOfMonth(nextMonthStart),
    };
  }

  const nextWeekStart = getWeekStart(
    addDays(previousPeriodEnd, 1),
    weekStartsOn,
  );

  return {
    periodStart: nextWeekStart,
    periodEnd: getWeeklyEndSaturday(nextWeekStart),
  };
};

const getFirstEligiblePeriod = (
  salaryType: SalaryType,
  baseDate: Date,
  weekStartsOn: WeekStartsOn,
) => {
  if (salaryType === SalaryType.MONTHLY) {
    const monthStart = startOfMonth(baseDate);

    return {
      periodStart: monthStart,
      periodEnd: endOfMonth(monthStart),
    };
  }

  const weekStart = getWeekStart(baseDate, weekStartsOn);

  return {
    periodStart: weekStart,
    periodEnd: getWeeklyEndSaturday(weekStart),
  };
};

export class SchedulerService {
  static async runPayrollScheduler(
    triggeredBy: "CRON" | "MANUAL" = "CRON",
    options: SchedulerRunOptions = {},
  ) {
    const timer = new PerformanceTimer("SchedulerService.runPayrollScheduler");
    timer.checkpoint("start");

    const startedAt = new Date();
    const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE || 100);
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
            startedAt,
          },
        });

    const result = {
      triggeredBy,
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
      result.totalEmployees = await SchedulerRepository.countActiveEmployees();
      timer.checkpoint("active employee count");

      await SchedulerRepository.updateRun(run.id, {
        status: SchedulerRunStatus.RUNNING,
        totalEmployees: result.totalEmployees,
        startedAt,
        metadata: {
          triggeredBy,
          triggeredByUserId: options.triggeredByUserId,
          mode: options.mode ?? triggeredBy,
          startedAt,
        },
      });
      timer.checkpoint("scheduler run initialized");

      const setting = await SchedulerRepository.getSystemSetting();
      const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;
      timer.checkpoint("system setting fetch");

      const currentDate = todayUtc();

      let cursor: string | undefined;

      while (true) {
        const employees = await SchedulerRepository.getActiveEmployeesBatch({
          take: BATCH_SIZE,
          ...(cursor ? { cursor } : {}),
        });
        timer.checkpoint("employee batch fetch");

        if (employees.length === 0) {
          break;
        }

        const employeeIds = employees.map((employee) => employee.id);
        const firstSalaryMap =
          await SchedulerRepository.getFirstSalaryHistories(employeeIds);
        const latestPayrollMap =
          await SchedulerRepository.getLatestPayrolls(employeeIds);
        const existingPayrollMap =
          await SchedulerRepository.getExistingPayrollsForBatch({
            employeeIds,
            maxPeriodEnd: currentDate,
          });
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

        for (const employee of employees) {
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
              continue;
            }

            const latestPayroll = latestPayrollMap.get(employee.id);

            let nextPeriod;

            if (latestPayroll) {
              nextPeriod = getNextPeriod(
                employee.salaryType,
                latestPayroll.periodEnd,
                weekStartsOn,
              );
            } else {
              const baseDate =
                employee.joiningDate > firstSalary.effectiveFrom
                  ? employee.joiningDate
                  : firstSalary.effectiveFrom;

              nextPeriod = getFirstEligiblePeriod(
                employee.salaryType,
                baseDate,
                weekStartsOn,
              );
            }

            while (nextPeriod.periodEnd < currentDate) {
              if (employee.joiningDate > nextPeriod.periodEnd) {
                result.skippedCount++;
                addResultItem(result.skipped, {
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  periodStart: formatDate(nextPeriod.periodStart),
                  periodEnd: formatDate(nextPeriod.periodEnd),
                  reason: "Employee joined after this period",
                });
                schedulerItemsToCreate.push({
                  runId: run.id,
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  periodStart: nextPeriod.periodStart,
                  periodEnd: nextPeriod.periodEnd,
                  status: SchedulerRunItemStatus.SKIPPED,
                  reason: "Employee joined after this period",
                });

                nextPeriod = getNextPeriod(
                  employee.salaryType,
                  nextPeriod.periodEnd,
                  weekStartsOn,
                );

                continue;
              }

              const payrollKey = SchedulerRepository.getPayrollPeriodKey(
                employee.id,
                nextPeriod.periodStart,
                nextPeriod.periodEnd,
              );

              const existingPayroll = existingPayrollMap.get(payrollKey);

              if (existingPayroll) {
                result.skippedCount++;
                addResultItem(result.skipped, {
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  periodStart: formatDate(nextPeriod.periodStart),
                  periodEnd: formatDate(nextPeriod.periodEnd),
                  reason: "Payroll already exists",
                });
                schedulerItemsToCreate.push({
                  runId: run.id,
                  employeeId: employee.id,
                  employeeCode: employee.employeeCode,
                  periodStart: nextPeriod.periodStart,
                  periodEnd: nextPeriod.periodEnd,
                  status: SchedulerRunItemStatus.SKIPPED,
                  reason: "Payroll already exists",
                });

                nextPeriod = getNextPeriod(
                  employee.salaryType,
                  nextPeriod.periodEnd,
                  weekStartsOn,
                );

                continue;
              }

              const payroll = await PayrollService.generate(
                {
                  employeeId: employee.id,
                  periodStart: formatDate(nextPeriod.periodStart),
                  periodEnd: formatDate(nextPeriod.periodEnd),
                  createPayslip: false,
                },
                "SUPER_ADMIN" as any,
              );

              const payrollResult = payroll as any;
              const generatedPayrollId =
                payrollResult?.payroll?.id ?? payrollResult?.id;
              const generatedPayrollVersion =
                payrollResult?.payroll?.version ?? payrollResult?.version ?? 1;

              if (!generatedPayrollId) {
                throw new Error("Payroll generation did not return payroll id");
              }

              existingPayrollMap.set(payrollKey, {
                id: generatedPayrollId,
                employeeId: employee.id,
                periodStart: nextPeriod.periodStart,
                periodEnd: nextPeriod.periodEnd,
                status: PayrollStatus.GENERATED,
                version: generatedPayrollVersion,
              });

              result.successCount++;
              addResultItem(result.generated, {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: formatDate(nextPeriod.periodStart),
                periodEnd: formatDate(nextPeriod.periodEnd),
                payrollId: generatedPayrollId,
              });
              schedulerItemsToCreate.push({
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: nextPeriod.periodStart,
                periodEnd: nextPeriod.periodEnd,
                status: SchedulerRunItemStatus.SUCCESS,
                payrollId: generatedPayrollId,
              });

              nextPeriod = getNextPeriod(
                employee.salaryType,
                nextPeriod.periodEnd,
                weekStartsOn,
              );
            }

            if (!latestPayroll && nextPeriod.periodEnd >= currentDate) {
              result.skippedCount++;
              addResultItem(result.skipped, {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                reason: "No completed payroll period available yet",
              });
              schedulerItemsToCreate.push({
                runId: run.id,
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                status: SchedulerRunItemStatus.SKIPPED,
                reason: "No completed payroll period available yet",
              });
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";

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
        }

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
    return SchedulerRepository.findRunById(id);
  }
}
