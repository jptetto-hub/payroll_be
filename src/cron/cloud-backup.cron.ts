import cron from "node-cron";
import { logger } from "../config/logger";
import { CloudBackupService } from "../modules/maintenance/cloud-backup.service";
import { getConfiguredTimezone } from "../config/timezone";
import { SettingsService } from "../modules/settings/settings.service";

const CRON_EXPRESSION = process.env.R2_BACKUP_CRON || "0 2 * * *";

const waitForBackup = async (operationId: string) => {
  while (true) {
    const operation = CloudBackupService.getOperation(operationId);

    if (operation.status !== "RUNNING") {
      return operation;
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
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
        const operation = CloudBackupService.startScheduledBackup();
        const result = await waitForBackup(operation.id);

        if (result.status !== "COMPLETED") {
          logger.error({ operation: result }, "Scheduled R2 backup failed");
          return;
        }

        logger.info({ operation: result }, "Scheduled R2 backup completed");

        if (process.env.R2_REMOTE_DELETE_ENABLED === "true") {
          const cleanup = await CloudBackupService.cleanupExpired({
            dryRun: false,
            confirmation: "DELETE_EXPIRED_BACKUPS",
          });
          logger.info({ cleanup }, "Scheduled R2 retention cleanup completed");
        }
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
};
