import { AuditAction } from "@prisma/client";
import { AuditLogRepository } from "./audit-log.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { getCurrentAuditMeta } from "../../shared/audit/audit-context";
import { normalizeAuditIpAddress } from "../../shared/audit/audit-ip.util";

export class AuditLogService {
  static async create(data: {
    userId?: string | undefined;
    employeeId?: string | undefined;
    action: AuditAction;
    module: string;
    entityId?: string | undefined;
    oldData?: any;
    newData?: any;
    description?: string | undefined;
    status?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    deviceInfo?: string | undefined;
    requestId?: string | undefined;
    sessionId?: string | undefined;
  }) {
    return this.log(data);
  }

  static async log(data: {
    userId?: string | undefined;
    employeeId?: string | undefined;
    action: AuditAction;
    module: string;
    entityId?: string | undefined;
    oldData?: any;
    newData?: any;
    description?: string | undefined;
    status?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    deviceInfo?: string | undefined;
    requestId?: string | undefined;
    sessionId?: string | undefined;
  }) {
    const context = getCurrentAuditMeta();
    const payload: {
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
    } = {
      action: data.action,
      module: data.module,
      status: data.status ?? "SUCCESS",
    };

    if (data.userId !== undefined) {
      payload.userId = data.userId;
    }

    if (data.employeeId !== undefined) {
      payload.employeeId = data.employeeId;
    }

    if (data.entityId !== undefined) {
      payload.entityId = data.entityId;
    }

    if (data.oldData !== undefined) {
      payload.oldData = data.oldData;
    }

    if (data.newData !== undefined) {
      payload.newData = data.newData;
    }

    if (data.description !== undefined) {
      payload.description = data.description;
    }

    const ipAddress = normalizeAuditIpAddress(data.ipAddress ?? context?.ipAddress);

    if (ipAddress !== undefined) {
      payload.ipAddress = ipAddress;
    }

    const userAgent = data.userAgent ?? context?.userAgent;
    const deviceInfo = data.deviceInfo ?? context?.deviceInfo;
    const requestId = data.requestId ?? context?.requestId;
    const sessionId = data.sessionId ?? context?.sessionId;

    if (userAgent !== undefined) {
      payload.userAgent = userAgent;
    }

    if (deviceInfo !== undefined) {
      payload.deviceInfo = deviceInfo;
    }

    if (requestId !== undefined) {
      payload.requestId = requestId;
    }

    if (sessionId !== undefined) {
      payload.sessionId = sessionId;
    }

    return AuditLogRepository.create(payload);
  }

  static async list(query: any) {
    const { page, limit, skip, take } = getPagination(query);

    const [logs, total] = await AuditLogRepository.list({
      skip,
      take,
      userId: query.userId,
      employeeId: query.employeeId,
      module: query.module,
      action: query.action,
      status: query.status,
      search: query.search,
      from: query.from,
      to: query.to,
    });

    return {
      data: logs,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async export(query: any) {
    return AuditLogRepository.export({
      userId: query.userId,
      employeeId: query.employeeId,
      module: query.module,
      action: query.action,
      status: query.status,
      search: query.search,
      from: query.from,
      to: query.to,
    });
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
