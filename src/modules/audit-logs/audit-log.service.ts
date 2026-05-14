import { AuditAction } from "@prisma/client";
import { AuditLogRepository } from "./audit-log.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";

export class AuditLogService {
  static async create(data: {
    userId?: string | undefined;
    action: AuditAction;
    module: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string | undefined;
  }) {
    return this.log(data);
  }

  static async log(data: {
    userId?: string | undefined;
    action: AuditAction;
    module: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string | undefined;
  }) {
    const payload: {
      userId?: string;
      action: AuditAction;
      module: string;
      oldData?: any;
      newData?: any;
      ipAddress?: string;
    } = {
      action: data.action,
      module: data.module,
    };

    if (data.userId !== undefined) {
      payload.userId = data.userId;
    }

    if (data.oldData !== undefined) {
      payload.oldData = data.oldData;
    }

    if (data.newData !== undefined) {
      payload.newData = data.newData;
    }

    if (data.ipAddress !== undefined) {
      payload.ipAddress = data.ipAddress;
    }

    return AuditLogRepository.create(payload);
  }

  static async list(query: any) {
    const { page, limit, skip, take } = getPagination(query);

    const [logs, total] = await AuditLogRepository.list({
      skip,
      take,
      userId: query.userId,
      module: query.module,
      action: query.action,
    });

    return {
      data: logs,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async getById(id: string) {
    const log = await AuditLogRepository.findById(id);

    if (!log) {
      throw new Error("Audit log not found");
    }

    return log;
  }

  static async listByUser(userId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const [logs, total] = await Promise.all([
      AuditLogRepository.listByUser(userId, { skip, take }),
      AuditLogRepository.countByUser(userId),
    ]);

    return {
      data: logs,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
