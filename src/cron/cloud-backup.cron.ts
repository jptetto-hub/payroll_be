import cron from "node-cron";
import { logger } from "../config/logger";
import { CloudBackupService } from "../modules/maintenance/cloud-backup.service";
import { getConfiguredTimezone } from "../config/timezone";
import { SettingsService } from "../modules/settings/settings.service";

const CRON_EXPRESSION = process.env.R2_BACKUP_CRON || "0 2 * * *";

const formatDateInTimezone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")}`;
};

const waitForBackup = async (operationId: string) => {
  while (true) {
    const operation = CloudBackupService.getOperation(operationId);

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

  const cleanup = await CloudBackupService.cleanupExpired({
    dryRun: false,
    confirmation: "DELETE_EXPIRED_BACKUPS",
  });
  logger.info({ cleanup }, "Scheduled R2 retention cleanup completed");
};

const runScheduledBackup = async (reason: string) => {
  const operation = CloudBackupService.startScheduledBackup();
  const result = await waitForBackup(operation.id);

  if (result.status !== "COMPLETED") {
    logger.error({ operation: result, reason }, "Scheduled R2 backup failed");
    return;
  }

  logger.info({ operation: result, reason }, "Scheduled R2 backup completed");
  await cleanupExpiredBackups();
};

const runStartupCatchUpBackup = async (timezone: string) => {
  if (process.env.R2_BACKUP_RUN_ON_STARTUP === "false") {
    return;
  }

  try {
    const today = formatDateInTimezone(new Date(), timezone);
    const backups = await CloudBackupService.listBackups();
    const hasTodayBackup = backups.objects.some((item) =>
      item.key.startsWith(`daily/payroll_${today}_`),
    );

    if (hasTodayBackup) {
      logger.info(
        { date: today },
        "R2 startup backup skipped: daily backup already exists",
      );
      return;
    }

    logger.warn(
      { date: today },
      "R2 startup backup catch-up running because today's daily backup is missing",
    );
    await runScheduledBackup("STARTUP_CATCH_UP");
  } catch (error) {
    logger.error({ error }, "R2 startup backup catch-up failed");
  }
};

export const startCloudBackupCron = async () => {
  if (process.env.R2_AUTO_BACKUP_ENABLED !== "true") {
    logger.info("Cloudflare R2 automatic backup cron is disabled");
    return;
  }

  const setting = await SettingsService.getSystemSettingCached();
  const cronTimezone = getConfiguredTimezone(
    process.env.R2_BACKUP_CRON_TIMEZONE || setting.organizationTimezone,
  );

  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        await runScheduledBackup("CRON");
      } catch (error) {
        logger.error({ error }, "Scheduled R2 backup cron failed");
      }
    },
    { timezone: cronTimezone },
  );

  logger.info(
    { expression: CRON_EXPRESSION, timezone: cronTimezone },
    "Cloudflare R2 backup cron scheduled",
  );

  void runStartupCatchUpBackup(cronTimezone);
};
