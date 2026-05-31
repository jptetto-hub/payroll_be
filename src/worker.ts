import "./jobs/payrollScheduler.worker";
import "./jobs/payslip.worker";
import { logger } from "./config/logger";
import { initSentry, Sentry } from "./config/sentry";
import { startWorkerHeartbeat } from "./modules/health/worker-heartbeat.service";
import { startPayrollCron } from "./cron/payroll.cron";
import { startCloudBackupCron } from "./cron/cloud-backup.cron";
import { SettingsService } from "./modules/settings/settings.service";
import { startOrganizationTimezoneSubscriber } from "./config/timezone-sync";

initSentry();
startWorkerHeartbeat("payroll-worker");

SettingsService.initializeOrganizationTimezone().then((timezone) => {
  logger.info({ timezone }, "Organization timezone loaded");
}).catch((error) => {
  logger.warn({ error }, "Using APP_TIMEZONE fallback because organization timezone could not be loaded");
}).then(() => startOrganizationTimezoneSubscriber()).catch((error) => {
  logger.warn({ error }, "Organization timezone Redis subscriber could not start");
}).then(() => startPayrollCron()).catch((error) => {
  logger.error({ error }, "Payroll cron failed to start");
  Sentry.captureException(error);
});
startCloudBackupCron().catch((error) => {
  logger.error({ error }, "Cloudflare R2 backup cron failed to start");
  Sentry.captureException(error);
});

logger.info({ pid: process.pid }, "Payroll workers started");
