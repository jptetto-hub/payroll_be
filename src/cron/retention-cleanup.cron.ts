import cron from "node-cron";
import { logger } from "../config/logger";
import { getConfiguredTimezone } from "../config/timezone";
import { MaintenanceService } from "../modules/maintenance/maintenance.service";

const RETENTION_CLEANUP_ENABLED =
  process.env.RETENTION_CLEANUP_ENABLED === "true";
const RETENTION_CLEANUP_CRON_EXPRESSION =
  process.env.RETENTION_CLEANUP_CRON_EXPRESSION || "30 2 * * *";

export const startRetentionCleanupCron = async () => {
  const timezone = getConfiguredTimezone(
    process.env.RETENTION_CLEANUP_TIMEZONE ||
      process.env.PAYROLL_CRON_TIMEZONE ||
      process.env.APP_TIMEZONE,
  );

  if (!RETENTION_CLEANUP_ENABLED) {
    logger.info(
      {
        enabled: false,
        expression: RETENTION_CLEANUP_CRON_EXPRESSION,
        timezone,
      },
      "Retention cleanup cron disabled",
    );
    return;
  }

  cron.schedule(
    RETENTION_CLEANUP_CRON_EXPRESSION,
    async () => {
      try {
        const result = await MaintenanceService.runCleanup();

        logger.info({ result }, "Retention cleanup completed");
      } catch (error) {
        logger.error({ error }, "Retention cleanup failed");
      }
    },
    {
      timezone,
    },
  );

  logger.info(
    {
      enabled: true,
      expression: RETENTION_CLEANUP_CRON_EXPRESSION,
      timezone,
      schedulerRunRetentionDays:
        process.env.SCHEDULER_RUN_RETENTION_DAYS ||
        process.env.SCHEDULER_ITEM_RETENTION_DAYS ||
        30,
      auditLogArchiveAfterDays:
        process.env.AUDIT_LOG_ARCHIVE_AFTER_DAYS ||
        process.env.AUDIT_LOG_RETENTION_DAYS ||
        180,
      auditLogDeleteArchivedEnabled:
        process.env.AUDIT_LOG_DELETE_ARCHIVED_ENABLED === "true",
    },
    "Retention cleanup cron scheduled",
  );
};
