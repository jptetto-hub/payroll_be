"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCloudBackupCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../config/logger");
const cloud_backup_service_1 = require("../modules/maintenance/cloud-backup.service");
const timezone_1 = require("../config/timezone");
const settings_service_1 = require("../modules/settings/settings.service");
const CRON_EXPRESSION = process.env.R2_BACKUP_CRON || "0 2 * * *";
const formatDateInTimezone = (date, timezone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${read("year")}-${read("month")}-${read("day")}`;
};
const waitForBackup = async (operationId) => {
    while (true) {
        const operation = cloud_backup_service_1.CloudBackupService.getOperation(operationId);
        if (operation.status !== "RUNNING") {
            return operation;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
};
const cleanupExpiredBackups = async () => {
    if (process.env.R2_REMOTE_DELETE_ENABLED !== "true") {
        return;
    }
    const cleanup = await cloud_backup_service_1.CloudBackupService.cleanupExpired({
        dryRun: false,
        confirmation: "DELETE_EXPIRED_BACKUPS",
    });
    logger_1.logger.info({ cleanup }, "Scheduled R2 retention cleanup completed");
};
const runScheduledBackup = async (reason) => {
    const operation = cloud_backup_service_1.CloudBackupService.startScheduledBackup();
    const result = await waitForBackup(operation.id);
    if (result.status !== "COMPLETED") {
        logger_1.logger.error({ operation: result, reason }, "Scheduled R2 backup failed");
        return;
    }
    logger_1.logger.info({ operation: result, reason }, "Scheduled R2 backup completed");
    await cleanupExpiredBackups();
};
const runStartupCatchUpBackup = async (timezone) => {
    if (process.env.R2_BACKUP_RUN_ON_STARTUP === "false") {
        return;
    }
    try {
        const today = formatDateInTimezone(new Date(), timezone);
        const backups = await cloud_backup_service_1.CloudBackupService.listBackups();
        const hasTodayBackup = backups.objects.some((item) => item.key.startsWith(`daily/payroll_${today}_`));
        if (hasTodayBackup) {
            logger_1.logger.info({ date: today }, "R2 startup backup skipped: daily backup already exists");
            return;
        }
        logger_1.logger.warn({ date: today }, "R2 startup backup catch-up running because today's daily backup is missing");
        await runScheduledBackup("STARTUP_CATCH_UP");
    }
    catch (error) {
        logger_1.logger.error({ error }, "R2 startup backup catch-up failed");
    }
};
const startCloudBackupCron = async () => {
    if (process.env.R2_AUTO_BACKUP_ENABLED !== "true") {
        logger_1.logger.info("Cloudflare R2 automatic backup cron is disabled");
        return;
    }
    const setting = await settings_service_1.SettingsService.getSystemSettingCached();
    const cronTimezone = (0, timezone_1.getConfiguredTimezone)(process.env.R2_BACKUP_CRON_TIMEZONE || setting.organizationTimezone);
    node_cron_1.default.schedule(CRON_EXPRESSION, async () => {
        try {
            await runScheduledBackup("CRON");
        }
        catch (error) {
            logger_1.logger.error({ error }, "Scheduled R2 backup cron failed");
        }
    }, { timezone: cronTimezone });
    logger_1.logger.info({ expression: CRON_EXPRESSION, timezone: cronTimezone }, "Cloudflare R2 backup cron scheduled");
    void runStartupCatchUpBackup(cronTimezone);
};
exports.startCloudBackupCron = startCloudBackupCron;
//# sourceMappingURL=cloud-backup.cron.js.map