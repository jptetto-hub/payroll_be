import cron from "node-cron";
import { SchedulerRunStatus } from "@prisma/client";
import { SchedulerRepository } from "../modules/scheduler/scheduler.repository";
import { payrollSchedulerQueue } from "../jobs/payrollScheduler.queue";
import { logger } from "../config/logger";

export const startPayrollCron = async () => {
  let setting;

  try {
    setting = await SchedulerRepository.getSystemSetting();
  } catch (error) {
    logger.error(
      { error },
      "Payroll scheduler startup check failed. Worker will continue without scheduling payroll cron.",
    );
    return;
  }

  if (setting && !setting.autoPayrollEnabled) {
    logger.info("Payroll scheduler skipped: autoPayrollEnabled is false");
    return;
  }

  cron.schedule("0 1 * * *", async () => {
    try {
      logger.info("Payroll cron triggered");

      const existingManualRun = await SchedulerRepository.findActiveRunByName(
        "MANUAL_PAYROLL_SCHEDULER",
      );
      const existingCronRun = await SchedulerRepository.findActiveRunByName(
        "CRON_PAYROLL_SCHEDULER",
      );

      if (existingManualRun || existingCronRun) {
        logger.warn(
          {
            existingManualRun,
            existingCronRun,
          },
          "Payroll cron skipped because scheduler is already running",
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
        },
      });

      await payrollSchedulerQueue.add(
        "manual-payroll-run",
        {
          runId: run.id,
          triggeredBy: undefined,
          triggeredByType: "CRON",
        },
        {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      logger.info({ runId: run.id }, "Payroll cron job queued");
    } catch (error) {
      logger.error({ error }, "Payroll cron failed to enqueue job");
    }
  });
};
