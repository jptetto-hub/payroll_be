import { AuditAction } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class AuditLogRepository {
  static create(data: {
    userId?: string;
    action: AuditAction;
    module: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data,
    });
  }

  static list(params: {
    skip: number;
    take: number;
    userId?: string;
    module?: string;
    action?: AuditAction;
  }) {
    const where = {
      ...(params.userId && { userId: params.userId }),
      ...(params.module && { module: params.module }),
      ...(params.action && { action: params.action }),
    };

    return prisma.$transaction([
      prisma.auditLog.findMany({
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
      prisma.auditLog.count({ where }),
    ]);
  }

  static findById(id: string) {
    return prisma.auditLog.findUnique({
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

  static listByUser(userId: string, pagination?: { skip: number; take: number }) {
    return prisma.auditLog.findMany({
      where: { userId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByUser(userId: string) {
    return prisma.auditLog.count({
      where: { userId },
    });
  }
}
