import cron from "node-cron";
import { SalaryType, SchedulerRunStatus } from "@prisma/client";
import { SchedulerRepository } from "../modules/scheduler/scheduler.repository";
import { SchedulerService } from "../modules/scheduler/scheduler.service";
import { payrollSchedulerQueue } from "../jobs/payrollScheduler.queue";
import { logger } from "../config/logger";
import { getConfiguredTimezone } from "../config/timezone";

const DAILY_CATCH_UP_CRON_EXPRESSION =
  process.env.PAYROLL_CRON_CATCH_UP_EXPRESSION || "5 0 * * *";
const MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION =
  process.env.PAYROLL_MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION || "59 11 * * *";

function getDueSalaryTypes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  const year = Number(read("year"));
  const month = Number(read("month"));
  const day = Number(read("day"));
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const salaryTypes: SalaryType[] = [];

  if (weekday === "Sat") {
    salaryTypes.push(SalaryType.WEEKLY);
  }

  if (day === lastDayOfMonth) {
    salaryTypes.push(SalaryType.MONTHLY);
  }

  return salaryTypes;
}

async function enqueuePayrollIfPending(params: {
  salaryTypes?: SalaryType[];
  reason: "CRON_DUE_TIME" | "DAILY_CATCH_UP" | "STARTUP_CATCH_UP";
}) {
  const setting = await SchedulerRepository.getSystemSetting();

  if (setting && !setting.autoPayrollEnabled) {
    logger.info(
      { salaryTypes: params.salaryTypes, reason: params.reason },
      "Payroll cron skipped: autoPayrollEnabled is false",
    );
    return;
  }

  await SchedulerService.recoverStaleRuns();

  const existingManualRun =
    await SchedulerRepository.findActiveRunByName("MANUAL_PAYROLL_SCHEDULER");
  const existingCronRun =
    await SchedulerRepository.findActiveRunByName("CRON_PAYROLL_SCHEDULER");

  if (existingManualRun || existingCronRun) {
    logger.warn(
      {
        existingManualRun,
        existingCronRun,
        salaryTypes: params.salaryTypes,
        reason: params.reason,
      },
      "Payroll cron skipped because scheduler is already running",
    );
    return;
  }

  const pendingPayrollCount =
    await SchedulerService.countPendingCurrentCyclePayrolls(params.salaryTypes);

  if (pendingPayrollCount === 0) {
    logger.info(
      { salaryTypes: params.salaryTypes, reason: params.reason },
      "Payroll cron skipped: all current payroll cycles are already handled",
    );
    return;
  }

  const salaryTypes = params.salaryTypes ?? [
    SalaryType.MONTHLY,
    SalaryType.WEEKLY,
  ];
  const run = await SchedulerRepository.createRun({
    name: "CRON_PAYROLL_SCHEDULER",
    status: SchedulerRunStatus.PENDING,
    metadata: {
      triggeredBy: "CRON",
      triggeredAt: new Date().toISOString(),
      mode: "BACKGROUND",
      reason: params.reason,
      salaryTypes,
      periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
    },
  });

  await payrollSchedulerQueue.add(
    "manual-payroll-run",
    {
      runId: run.id,
      triggeredBy: undefined,
      triggeredByType: "CRON",
      salaryTypes,
    },
    {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  );

  logger.info(
    { runId: run.id, salaryTypes, pendingPayrollCount, reason: params.reason },
    "Payroll cron job queued",
  );
}

export const startPayrollCron = async () => {
  const setting = await SchedulerRepository.getSystemSetting();
  const cronTimezone = getConfiguredTimezone(
    process.env.PAYROLL_CRON_TIMEZONE || setting?.organizationTimezone,
  );

  cron.schedule(
    MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION,
    async () => {
      try {
        const salaryTypes = getDueSalaryTypes(new Date(), cronTimezone);

        if (salaryTypes.length === 0) {
          return;
        }

        const reminder =
          await SchedulerService.getManualAdvanceDeductionReminders(
            salaryTypes,
          );

        if (reminder.count > 0) {
          logger.warn(
            {
              count: reminder.count,
              items: reminder.items,
              salaryTypes,
            },
            "Manual advance deduction reminder: amounts missing before payroll cron",
          );
        } else {
          logger.info(
            { salaryTypes },
            "Manual advance deduction reminder checked: no missing amounts",
          );
        }
      } catch (error) {
        logger.error(
          { error },
          "Manual advance deduction reminder cron failed",
        );
      }
    },
    {
      timezone: cronTimezone,
    },
  );

  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        const salaryTypes = getDueSalaryTypes(new Date(), cronTimezone);

        if (salaryTypes.length === 0) {
          return;
        }

        await enqueuePayrollIfPending({
          salaryTypes,
          reason: "CRON_DUE_TIME",
        });
      } catch (error) {
        logger.error({ error }, "Payroll cron failed to enqueue job");
      }
    },
    {
      timezone: cronTimezone,
    },
  );

  cron.schedule(
    DAILY_CATCH_UP_CRON_EXPRESSION,
    async () => {
      try {
        await enqueuePayrollIfPending({ reason: "DAILY_CATCH_UP" });
      } catch (error) {
        logger.error({ error }, "Payroll cron catch-up failed to enqueue job");
      }
    },
    {
      timezone: cronTimezone,
    },
  );

  logger.info(
    {
      timezone: cronTimezone,
      dueExpression: "59 23 * * *",
      manualAdvanceReminderExpression:
        MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION,
      catchUpExpression: DAILY_CATCH_UP_CRON_EXPRESSION,
    },
    "Payroll cron scheduled",
  );

  if (process.env.PAYROLL_CRON_RUN_ON_STARTUP !== "false") {
    void enqueuePayrollIfPending({ reason: "STARTUP_CATCH_UP" }).catch(
      (error) => {
        logger.error({ error }, "Payroll startup catch-up failed");
      },
    );
  }
};
