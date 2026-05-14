import { SalaryType, WeekStartsOn } from "@prisma/client";
import { SchedulerRepository } from "./scheduler.repository";
import { PayrollService } from "../payroll/payroll.service";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";

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
  static async runPayrollScheduler(triggeredBy: "CRON" | "MANUAL" = "CRON") {
    const startedAt = new Date();

    const run = await SchedulerRepository.createRun({
      name: "PAYROLL_SCHEDULER",
      startedAt,
      success: false,
      metadata: {
        triggeredBy,
        startedAt,
      },
    });

    const result = {
      triggeredBy,
      totalEmployees: 0,
      successCount: 0,
      skippedCount: 0,
      failureCount: 0,
      generated: [] as any[],
      skipped: [] as any[],
      failed: [] as any[],
    };

    try {
      const employees = await SchedulerRepository.getActiveEmployees();

      result.totalEmployees = employees.length;

      const setting = await SchedulerRepository.getSystemSetting();
      const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

      const currentDate = todayUtc();

      for (const employee of employees) {
        try {
          const firstSalary = await SchedulerRepository.getFirstSalaryHistory(
            employee.id,
          );

          if (!firstSalary) {
            result.skippedCount++;
            result.skipped.push({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              reason: "No salary history found",
            });
            continue;
          }

          const latestPayroll = await SchedulerRepository.getLatestPayroll(
            employee.id,
          );

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
              result.skipped.push({
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: formatDate(nextPeriod.periodStart),
                periodEnd: formatDate(nextPeriod.periodEnd),
                reason: "Employee joined after this period",
              });

              nextPeriod = getNextPeriod(
                employee.salaryType,
                nextPeriod.periodEnd,
                weekStartsOn,
              );

              continue;
            }

            const existingPayroll = await SchedulerRepository.findPayroll(
              employee.id,
              nextPeriod.periodStart,
              nextPeriod.periodEnd,
            );

            if (existingPayroll) {
              result.skippedCount++;
              result.skipped.push({
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                periodStart: formatDate(nextPeriod.periodStart),
                periodEnd: formatDate(nextPeriod.periodEnd),
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
              },
              "SUPER_ADMIN" as any,
            );

            result.successCount++;
            result.generated.push({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              periodStart: formatDate(nextPeriod.periodStart),
              periodEnd: formatDate(nextPeriod.periodEnd),
              payroll,
            });

            nextPeriod = getNextPeriod(
              employee.salaryType,
              nextPeriod.periodEnd,
              weekStartsOn,
            );
          }

          if (!latestPayroll && nextPeriod.periodEnd >= currentDate) {
            result.skippedCount++;
            result.skipped.push({
              employeeId: employee.id,
              employeeCode: employee.employeeCode,
              reason: "No completed payroll period available yet",
            });
          }
        } catch (error) {
          result.failureCount++;
          result.failed.push({
            employeeId: employee.id,
            employeeCode: employee.employeeCode,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      await SchedulerRepository.updateRun(run.id, {
        finishedAt: new Date(),
        success: result.failureCount === 0,
        metadata: result,
      });

      return result;
    } catch (error) {
      await SchedulerRepository.updateRun(run.id, {
        finishedAt: new Date(),
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: result,
      });

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
}
