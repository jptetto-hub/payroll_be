import "./jobs/payrollScheduler.worker";
import "./jobs/payslip.worker";
import { logger } from "./config/logger";
import { initSentry, Sentry } from "./config/sentry";
import { startWorkerHeartbeat } from "./modules/health/worker-heartbeat.service";
import { startPayrollCron } from "./cron/payroll.cron";
import { startCloudBackupCron } from "./cron/cloud-backup.cron";
import { startRetentionCleanupCron } from "./cron/retention-cleanup.cron";
import { SettingsService } from "./modules/settings/settings.service";
import { startOrganizationTimezoneSubscriber } from "./config/timezone-sync";

initSentry();

async function bootstrapWorker() {
  try {
    const timezone = await SettingsService.initializeOrganizationTimezone();
    logger.info({ timezone }, "Organization timezone loaded");
  } catch (error) {
    logger.warn(
      { error },
      "Using APP_TIMEZONE fallback because organization timezone could not be loaded",
    );
  }

  try {
    startOrganizationTimezoneSubscriber();
  } catch (error) {
    logger.warn(
      { error },
      "Organization timezone Redis subscriber could not start",
    );
  }

  try {
    await startPayrollCron();
  } catch (error) {
    logger.error({ error }, "Payroll cron failed to start");
    Sentry.captureException(error);
  }

  try {
    await startCloudBackupCron();
  } catch (error) {
    logger.error({ error }, "Cloudflare R2 backup cron failed to start");
    Sentry.captureException(error);
  }

  try {
    await startRetentionCleanupCron();
  } catch (error) {
    logger.error({ error }, "Retention cleanup cron failed to start");
    Sentry.captureException(error);
  }

  startWorkerHeartbeat("payroll-worker");
  logger.info({ pid: process.pid }, "Payroll workers started");
}

bootstrapWorker().catch((error) => {
  logger.error({ error }, "Payroll worker bootstrap failed");
  Sentry.captureException(error);
});
