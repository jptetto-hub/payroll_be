"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
function daysAgo(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date;
}
class MaintenanceService {
    static async archiveOldAuditLogs() {
        const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS || 365);
        const cutoffDate = daysAgo(retentionDays);
        const oldLogs = await prisma_1.prisma.auditLog.findMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
            take: 1000,
            orderBy: {
                createdAt: "asc",
            },
        });
        if (oldLogs.length === 0) {
            return {
                archived: 0,
                deleted: 0,
                cutoffDate,
            };
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.auditLogArchive.createMany({
                data: oldLogs.map((log) => ({
                    id: log.id,
                    userId: log.userId,
                    employeeId: log.employeeId,
                    action: String(log.action),
                    module: log.module,
                    entityId: log.entityId,
                    oldData: log.oldData ?? client_1.Prisma.JsonNull,
                    newData: log.newData ?? client_1.Prisma.JsonNull,
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
            await tx.auditLog.deleteMany({
                where: {
                    id: {
                        in: oldLogs.map((log) => log.id),
                    },
                },
            });
        });
        return {
            archived: oldLogs.length,
            deleted: oldLogs.length,
            cutoffDate,
        };
    }
    static async cleanupOldSchedulerRunItems() {
        const retentionDays = Number(process.env.SCHEDULER_ITEM_RETENTION_DAYS || 90);
        const cutoffDate = daysAgo(retentionDays);
        const result = await prisma_1.prisma.schedulerRunItem.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });
        return {
            deleted: result.count,
            cutoffDate,
        };
    }
    static async runCleanup() {
        const auditLogs = await this.archiveOldAuditLogs();
        const schedulerRunItems = await this.cleanupOldSchedulerRunItems();
        return {
            auditLogs,
            schedulerRunItems,
        };
    }
}
exports.MaintenanceService = MaintenanceService;
//# sourceMappingURL=maintenance.service.js.map