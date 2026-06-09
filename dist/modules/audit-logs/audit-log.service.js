"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const audit_log_repository_1 = require("./audit-log.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cursor_pagination_util_1 = require("../../shared/utils/cursor-pagination.util");
const audit_context_1 = require("../../shared/audit/audit-context");
const audit_ip_util_1 = require("../../shared/audit/audit-ip.util");
const sanitize_audit_data_util_1 = require("../../shared/audit/sanitize-audit-data.util");
class AuditLogService {
    static async create(data) {
        return this.log(data);
    }
    static async log(data) {
        const context = (0, audit_context_1.getCurrentAuditMeta)();
        const payload = {
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
            payload.oldData = (0, sanitize_audit_data_util_1.sanitizeAuditData)(data.oldData);
        }
        if (data.newData !== undefined) {
            payload.newData = (0, sanitize_audit_data_util_1.sanitizeAuditData)(data.newData);
        }
        if (data.description !== undefined) {
            payload.description = data.description;
        }
        const ipAddress = (0, audit_ip_util_1.normalizeAuditIpAddress)(data.ipAddress ?? context?.ipAddress);
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
        return audit_log_repository_1.AuditLogRepository.create(payload, {
            skipRelationValidation: data.skipRelationValidation,
        });
    }
    static async list(query) {
        const { limit, cursor } = (0, cursor_pagination_util_1.getCursorPagination)(query);
        const logs = await audit_log_repository_1.AuditLogRepository.list({
            take: limit + 1,
            ...(cursor && { cursor }),
            userId: query.userId,
            employeeId: query.employeeId,
            module: query.module,
            action: query.action,
            status: query.status,
            search: query.search,
            from: query.from,
            to: query.to,
        });
        const { data, pagination } = (0, cursor_pagination_util_1.buildCursorPaginationMeta)(logs, limit);
        return {
            data,
            pagination,
        };
    }
    static async listArchive(query) {
        const { limit, cursor } = (0, cursor_pagination_util_1.getCursorPagination)(query);
        const logs = await audit_log_repository_1.AuditLogRepository.listArchive({
            take: limit + 1,
            ...(cursor && { cursor }),
            userId: query.userId,
            employeeId: query.employeeId,
            module: query.module,
            action: query.action,
            status: query.status,
            search: query.search,
            from: query.from,
            to: query.to,
        });
        const normalizedLogs = logs.map((log) => ({
            ...log,
            createdAt: log.originalCreatedAt,
        }));
        const { data, pagination } = (0, cursor_pagination_util_1.buildCursorPaginationMeta)(normalizedLogs, limit);
        return {
            data,
            pagination,
        };
    }
    static async export(query) {
        return audit_log_repository_1.AuditLogRepository.export({
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
    static async getById(id) {
        const log = await audit_log_repository_1.AuditLogRepository.findById(id);
        if (!log) {
            throw new Error("Audit log not found");
        }
        return log;
    }
    static async listByUser(userId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [logs, total] = await Promise.all([
            audit_log_repository_1.AuditLogRepository.listByUser(userId, { skip, take }),
            audit_log_repository_1.AuditLogRepository.countByUser(userId),
        ]);
        return {
            data: logs,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.AuditLogService = AuditLogService;
//# sourceMappingURL=audit-log.service.js.map