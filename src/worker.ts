import "./jobs/payrollScheduler.worker";
import "./jobs/payslip.worker";
import { logger } from "./config/logger";
import { initSentry, Sentry } from "./config/sentry";
import { startWorkerHeartbeat } from "./modules/health/worker-heartbeat.service";
import { startPayrollCron } from "./cron/payroll.cron";

initSentry();
startWorkerHeartbeat("payroll-worker");

startPayrollCron().catch((error) => {
  logger.error({ error }, "Payroll cron failed to start");
  Sentry.captureException(error);
});

logger.info({ pid: process.pid }, "Payroll workers started");
