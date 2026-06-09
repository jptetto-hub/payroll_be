"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./jobs/payrollScheduler.worker");
require("./jobs/payslip.worker");
const logger_1 = require("./config/logger");
const sentry_1 = require("./config/sentry");
const worker_heartbeat_service_1 = require("./modules/health/worker-heartbeat.service");
const payroll_cron_1 = require("./cron/payroll.cron");
const cloud_backup_cron_1 = require("./cron/cloud-backup.cron");
const settings_service_1 = require("./modules/settings/settings.service");
const timezone_sync_1 = require("./config/timezone-sync");
(0, sentry_1.initSentry)();
async function bootstrapWorker() {
    try {
        const timezone = await settings_service_1.SettingsService.initializeOrganizationTimezone();
        logger_1.logger.info({ timezone }, "Organization timezone loaded");
    }
    catch (error) {
        logger_1.logger.warn({ error }, "Using APP_TIMEZONE fallback because organization timezone could not be loaded");
    }
    try {
        (0, timezone_sync_1.startOrganizationTimezoneSubscriber)();
    }
    catch (error) {
        logger_1.logger.warn({ error }, "Organization timezone Redis subscriber could not start");
    }
    try {
        await (0, payroll_cron_1.startPayrollCron)();
    }
    catch (error) {
        logger_1.logger.error({ error }, "Payroll cron failed to start");
        sentry_1.Sentry.captureException(error);
    }
    try {
        await (0, cloud_backup_cron_1.startCloudBackupCron)();
    }
    catch (error) {
        logger_1.logger.error({ error }, "Cloudflare R2 backup cron failed to start");
        sentry_1.Sentry.captureException(error);
    }
    (0, worker_heartbeat_service_1.startWorkerHeartbeat)("payroll-worker");
    logger_1.logger.info({ pid: process.pid }, "Payroll workers started");
}
bootstrapWorker().catch((error) => {
    logger_1.logger.error({ error }, "Payroll worker bootstrap failed");
    sentry_1.Sentry.captureException(error);
});
//# sourceMappingURL=worker.js.map