"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogRepository = void 0;
const prisma_1 = require("../../config/prisma");
class AuditLogRepository {
    static create(data) {
        return prisma_1.prisma.auditLog.create({
            data,
        });
    }
    static list(params) {
        const where = {
            ...(params.userId && { userId: params.userId }),
            ...(params.module && { module: params.module }),
            ...(params.action && { action: params.action }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.auditLog.findMany({
                where,
                skip: params.skip,
                take: params.take,
                include: {
                    user: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                            phone: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.auditLog.count({ where }),
        ]);
    }
    static findById(id) {
        return prisma_1.prisma.auditLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        role: true,
                    },
                },
            },
        });
    }
    static listByUser(userId, pagination) {
        return prisma_1.prisma.auditLog.findMany({
            where: { userId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
        });
    }
    static countByUser(userId) {
        return prisma_1.prisma.auditLog.count({
            where: { userId },
        });
    }
}
exports.AuditLogRepository = AuditLogRepository;
//# sourceMappingURL=audit-log.repository.js.map