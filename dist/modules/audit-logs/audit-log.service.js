"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const audit_log_repository_1 = require("./audit-log.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
class AuditLogService {
    static async create(data) {
        return this.log(data);
    }
    static async log(data) {
        const payload = {
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
        return audit_log_repository_1.AuditLogRepository.create(payload);
    }
    static async list(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [logs, total] = await audit_log_repository_1.AuditLogRepository.list({
            skip,
            take,
            userId: query.userId,
            module: query.module,
            action: query.action,
        });
        return {
            data: logs,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
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