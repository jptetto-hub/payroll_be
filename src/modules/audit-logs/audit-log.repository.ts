import { AuditAction } from "@prisma/client";
import { prisma, readPrisma } from "../../config/prisma";
import { normalizeAuditIpAddress } from "../../shared/audit/audit-ip.util";

export class AuditLogRepository {
  static async create(data: {
    userId?: string;
    employeeId?: string;
    action: AuditAction;
    module: string;
    entityId?: string;
    oldData?: any;
    newData?: any;
    description?: string;
    status?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    requestId?: string;
    sessionId?: string;
  }, options: { skipRelationValidation?: boolean } = {}) {
    let userId = data.userId;
    let employeeId = data.employeeId;

    if (userId && !options.skipRelationValidation) {
      const userExists = await prisma.employee.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        userId = undefined;
      }
    }

    if (employeeId && !options.skipRelationValidation) {
      const employeeExists = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      });

      if (!employeeExists) {
        employeeId = undefined;
      }
    }

    const ipAddress = normalizeAuditIpAddress(data.ipAddress);
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

    return prisma.auditLog.create({
      data: createData as any,
    });
  }

  static list(params: {
    take: number;
    cursor?: string;
    userId?: string;
    employeeId?: string;
    module?: string;
    action?: AuditAction;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {
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

    return readPrisma.auditLog.findMany({
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
      } as any);
  }

  static listArchive(params: {
    take: number;
    cursor?: string;
    userId?: string;
    employeeId?: string;
    module?: string;
    action?: AuditAction;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {
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

    return readPrisma.auditLogArchive.findMany({
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
    } as any);
  }

  static findById(id: string) {
    return readPrisma.auditLog.findUnique({
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
    } as any);
  }

  static listByUser(userId: string, pagination?: { skip: number; take: number }) {
    return readPrisma.auditLog.findMany({
      where: { userId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByUser(userId: string) {
    return readPrisma.auditLog.count({
      where: { userId },
    });
  }

  static export(params: {
    userId?: string;
    employeeId?: string;
    module?: string;
    action?: AuditAction;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }) {
    return this.list({
      take: 5000,
      ...params,
    });
  }
}
