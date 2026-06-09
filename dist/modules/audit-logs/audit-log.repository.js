"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogRepository = void 0;
const prisma_1 = require("../../config/prisma");
const audit_ip_util_1 = require("../../shared/audit/audit-ip.util");
class AuditLogRepository {
    static async create(data, options = {}) {
        let userId = data.userId;
        let employeeId = data.employeeId;
        if (userId && !options.skipRelationValidation) {
            const userExists = await prisma_1.prisma.employee.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (!userExists) {
                userId = undefined;
            }
        }
        if (employeeId && !options.skipRelationValidation) {
            const employeeExists = await prisma_1.prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true },
            });
            if (!employeeExists) {
                employeeId = undefined;
            }
        }
        const ipAddress = (0, audit_ip_util_1.normalizeAuditIpAddress)(data.ipAddress);
        const createData = {
            action: data.action,
            module: data.module,
            ...(userId && { userId }),
            ...(employeeId && { employeeId }),
            ...(data.entityId !== undefined && { entityId: data.entityId }),
            ...(data.oldData !== undefined && { oldData: data.oldData }),
            ...(data.newData !== undefined && { newData: data.newData }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.status !== undefined && { status: data.status }),
            ...(ipAddress !== undefined && { ipAddress }),
            ...(data.userAgent !== undefined && { userAgent: data.userAgent }),
            ...(data.deviceInfo !== undefined && { deviceInfo: data.deviceInfo }),
            ...(data.requestId !== undefined && { requestId: data.requestId }),
            ...(data.sessionId !== undefined && { sessionId: data.sessionId }),
        };
        return prisma_1.prisma.auditLog.create({
            data: createData,
        });
    }
    static list(params) {
        const where = {
            ...(params.userId && { userId: params.userId }),
            ...(params.employeeId && { employeeId: params.employeeId }),
            ...(params.module && { module: params.module }),
            ...(params.action && { action: params.action }),
            ...(params.status && { status: params.status }),
            ...((params.from || params.to) && {
                createdAt: {
                    ...(params.from && { gte: new Date(`${params.from}T00:00:00.000Z`) }),
                    ...(params.to && { lte: new Date(`${params.to}T23:59:59.999Z`) }),
                },
            }),
            ...(params.search && {
                OR: [
                    { module: { contains: params.search, mode: "insensitive" } },
                    { description: { contains: params.search, mode: "insensitive" } },
                    { status: { contains: params.search, mode: "insensitive" } },
                    { ipAddress: { contains: params.search, mode: "insensitive" } },
                    { deviceInfo: { contains: params.search, mode: "insensitive" } },
                    { requestId: { contains: params.search, mode: "insensitive" } },
                    { user: { name: { contains: params.search, mode: "insensitive" } } },
                    {
                        user: {
                            employeeCode: { contains: params.search, mode: "insensitive" },
                        },
                    },
                    {
                        employee: {
                            name: { contains: params.search, mode: "insensitive" },
                        },
                    },
                    {
                        employee: {
                            employeeCode: { contains: params.search, mode: "insensitive" },
                        },
                    },
                ],
            }),
        };
        return prisma_1.readPrisma.auditLog.findMany({
            where,
            take: params.take,
            ...(params.cursor
                ? {
                    skip: 1,
                    cursor: { id: params.cursor },
                }
                : {}),
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                userId: true,
                employeeId: true,
                action: true,
                module: true,
                entityId: true,
                description: true,
                status: true,
                ipAddress: true,
                deviceInfo: true,
                requestId: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                    },
                },
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                    },
                },
            },
        });
    }
    static listArchive(params) {
        const where = {
            ...(params.userId && { userId: params.userId }),
            ...(params.employeeId && { employeeId: params.employeeId }),
            ...(params.module && { module: params.module }),
            ...(params.action && { action: params.action }),
            ...(params.status && { status: params.status }),
            ...((params.from || params.to) && {
                originalCreatedAt: {
                    ...(params.from && { gte: new Date(`${params.from}T00:00:00.000Z`) }),
                    ...(params.to && { lte: new Date(`${params.to}T23:59:59.999Z`) }),
                },
            }),
            ...(params.search && {
                OR: [
                    { module: { contains: params.search, mode: "insensitive" } },
                    { description: { contains: params.search, mode: "insensitive" } },
                    { status: { contains: params.search, mode: "insensitive" } },
                    { ipAddress: { contains: params.search, mode: "insensitive" } },
                    { deviceInfo: { contains: params.search, mode: "insensitive" } },
                    { requestId: { contains: params.search, mode: "insensitive" } },
                ],
            }),
        };
        return prisma_1.readPrisma.auditLogArchive.findMany({
            where,
            take: params.take,
            ...(params.cursor
                ? {
                    skip: 1,
                    cursor: { id: params.cursor },
                }
                : {}),
            orderBy: { originalCreatedAt: "desc" },
            select: {
                id: true,
                userId: true,
                employeeId: true,
                action: true,
                module: true,
                entityId: true,
                description: true,
                status: true,
                ipAddress: true,
                deviceInfo: true,
                requestId: true,
                oldData: true,
                newData: true,
                originalCreatedAt: true,
                archivedAt: true,
            },
        });
    }
    static findById(id) {
        return prisma_1.readPrisma.auditLog.findUnique({
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
                employee: {
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
        return prisma_1.readPrisma.auditLog.findMany({
            where: { userId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
        });
    }
    static countByUser(userId) {
        return prisma_1.readPrisma.auditLog.count({
            where: { userId },
        });
    }
    static export(params) {
        return this.list({
            take: 5000,
            ...params,
        });
    }
}
exports.AuditLogRepository = AuditLogRepository;
//# sourceMappingURL=audit-log.repository.js.map