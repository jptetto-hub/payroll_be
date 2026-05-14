import cron from "node-cron";
import { SchedulerService } from "../modules/scheduler/scheduler.service";
import { SchedulerRepository } from "../modules/scheduler/scheduler.repository";

export const startPayrollCron = async () => {
  const setting = await SchedulerRepository.getSystemSetting();

  if (setting && !setting.autoPayrollEnabled) {
    console.log("Payroll scheduler skipped: autoPayrollEnabled is false");
    return;
  }

  cron.schedule("0 1 * * *", async () => {
    try {
      console.log("Payroll scheduler started");

      const result = await SchedulerService.runPayrollScheduler("CRON");

      console.log("Payroll scheduler completed", {
        generated: result.successCount,
        skipped: result.skippedCount,
        failed: result.failureCount,
      });
    } catch (error) {
      console.error("Payroll scheduler failed", error);
    }
  });
};
