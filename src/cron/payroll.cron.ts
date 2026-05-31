import cron from "node-cron";
import { SalaryType, SchedulerRunStatus } from "@prisma/client";
import { SchedulerRepository } from "../modules/scheduler/scheduler.repository";
import { SchedulerService } from "../modules/scheduler/scheduler.service";
import { payrollSchedulerQueue } from "../jobs/payrollScheduler.queue";
import { logger } from "../config/logger";

const CRON_TIMEZONE = process.env.PAYROLL_CRON_TIMEZONE || "Asia/Kolkata";

function getDueSalaryTypes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CRON_TIMEZONE,
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

export const startPayrollCron = async () => {
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        const salaryTypes = getDueSalaryTypes();

        if (salaryTypes.length === 0) {
          return;
        }

        const setting = await SchedulerRepository.getSystemSetting();

        if (setting && !setting.autoPayrollEnabled) {
          logger.info(
            { salaryTypes },
            "Payroll cron skipped: autoPayrollEnabled is false",
          );
          return;
        }

        await SchedulerService.recoverStaleRuns();

        const existingManualRun =
          await SchedulerRepository.findActiveRunByName(
            "MANUAL_PAYROLL_SCHEDULER",
          );
        const existingCronRun = await SchedulerRepository.findActiveRunByName(
          "CRON_PAYROLL_SCHEDULER",
        );

        if (existingManualRun || existingCronRun) {
          logger.warn(
            { existingManualRun, existingCronRun, salaryTypes },
            "Payroll cron skipped because scheduler is already running",
          );
          return;
        }

        const pendingPayrollCount =
          await SchedulerService.countPendingCurrentCyclePayrolls(salaryTypes);

        if (pendingPayrollCount === 0) {
          logger.info(
            { salaryTypes },
            "Payroll cron skipped: all current payroll cycles are already handled",
          );
          return;
        }

        const run = await SchedulerRepository.createRun({
          name: "CRON_PAYROLL_SCHEDULER",
          status: SchedulerRunStatus.PENDING,
          metadata: {
            triggeredBy: "CRON",
            triggeredAt: new Date().toISOString(),
            mode: "BACKGROUND",
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

        logger.info({ runId: run.id, salaryTypes }, "Payroll cron job queued");
      } catch (error) {
        logger.error({ error }, "Payroll cron failed to enqueue job");
      }
    },
    {
      timezone: CRON_TIMEZONE,
    },
  );

  logger.info(
    { timezone: CRON_TIMEZONE },
    "Payroll cron scheduled for Saturday and month-end at 11:59 PM",
  );
};
