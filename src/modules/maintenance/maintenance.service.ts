import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

const RETENTION_CLEANUP_ENABLED =
  process.env.RETENTION_CLEANUP_ENABLED === "true";
const AUDIT_LOG_DELETE_ARCHIVED_ENABLED =
  process.env.AUDIT_LOG_DELETE_ARCHIVED_ENABLED === "true";
const AUDIT_LOG_ARCHIVE_BATCH_SIZE = Number(
  process.env.AUDIT_LOG_ARCHIVE_BATCH_SIZE || 1000,
);

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export class MaintenanceService {
  static async archiveOldAuditLogs() {
    const retentionDays = Number(
      process.env.AUDIT_LOG_ARCHIVE_AFTER_DAYS ||
        process.env.AUDIT_LOG_RETENTION_DAYS ||
        180,
    );
    const cutoffDate = daysAgo(retentionDays);

    const oldLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      take: AUDIT_LOG_ARCHIVE_BATCH_SIZE,
      orderBy: {
        createdAt: "asc",
      },
    });

    if (oldLogs.length === 0) {
      return {
        archived: 0,
        deleted: 0,
        deleteArchivedEnabled: AUDIT_LOG_DELETE_ARCHIVED_ENABLED,
        retentionDays,
        cutoffDate,
      };
    }

    const archiveResult = await prisma.$transaction(async (tx) => {
      const archived = await tx.auditLogArchive.createMany({
        data: oldLogs.map((log) => ({
          id: log.id,
          userId: log.userId,
          employeeId: log.employeeId,
          action: String(log.action),
          module: log.module,
          entityId: log.entityId,
          oldData: log.oldData ?? Prisma.JsonNull,
          newData: log.newData ?? Prisma.JsonNull,
          description: log.description,
          status: log.status,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          deviceInfo: log.deviceInfo,
          requestId: log.requestId,
          sessionId: log.sessionId,
          originalCreatedAt: log.createdAt,
        })),
        skipDuplicates: true,
      });

      if (!AUDIT_LOG_DELETE_ARCHIVED_ENABLED) {
        return {
          archived: archived.count,
          deleted: 0,
        };
      }

      const deleted = await tx.auditLog.deleteMany({
        where: {
          id: {
            in: oldLogs.map((log) => log.id),
          },
        },
      });

      return {
        archived: archived.count,
        deleted: deleted.count,
      };
    });

    return {
      archived: archiveResult.archived,
      scanned: oldLogs.length,
      deleted: archiveResult.deleted,
      deleteArchivedEnabled: AUDIT_LOG_DELETE_ARCHIVED_ENABLED,
      retentionDays,
      cutoffDate,
    };
  }

  static async cleanupOldSchedulerRuns() {
    const retentionDays = Number(
      process.env.SCHEDULER_RUN_RETENTION_DAYS ||
        process.env.SCHEDULER_ITEM_RETENTION_DAYS ||
        30,
    );
    const cutoffDate = daysAgo(retentionDays);

    const runResult = await prisma.schedulerRun.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    const result = await prisma.schedulerRunItem.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      deletedRuns: runResult.count,
      deletedOrphanItems: result.count,
      retentionDays,
      cutoffDate,
    };
  }

  static async runCleanup() {
    if (!RETENTION_CLEANUP_ENABLED) {
      return {
        enabled: false,
        message:
          "Retention cleanup is disabled. Set RETENTION_CLEANUP_ENABLED=true to enable it.",
      };
    }

    const auditLogs = await this.archiveOldAuditLogs();
    const schedulerRuns = await this.cleanupOldSchedulerRuns();

    return {
      enabled: true,
      auditLogs,
      schedulerRuns,
    };
  }
}
