"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const settings_repository_1 = require("./settings.repository");
const overtime_service_1 = require("../../services/overtime.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cache_1 = require("../../utils/cache");
const timezone_1 = require("../../config/timezone");
const system_restart_service_1 = require("../maintenance/system-restart.service");
const timezone_sync_1 = require("../../config/timezone-sync");
const logger_1 = require("../../config/logger");
const role_permissions_1 = require("./role-permissions");
const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
const WORK_HOUR_SETTINGS_READ_CACHE_PREFIX = "work-hour-settings-read";
const WORK_HOUR_SETTINGS_READ_CACHE_TTL = 60 * 5;
class SettingsService {
    static async initializeOrganizationTimezone() {
        const setting = await settings_repository_1.SettingsRepository.get();
        return (0, timezone_1.setOrganizationTimezone)(setting.organizationTimezone);
    }
    static async getSettings() {
        const setting = await this.getSystemSettingCached();
        return {
            ...setting,
            rolePermissions: (0, role_permissions_1.normalizeRolePermissions)(setting.rolePermissions),
        };
    }
    static async getSystemSettingCached() {
        const cached = await cache_1.CacheService.get(SYSTEM_SETTINGS_CACHE_KEY);
        if (cached?.organizationTimezone) {
            return cached;
        }
        const setting = await settings_repository_1.SettingsRepository.get();
        await cache_1.CacheService.set(SYSTEM_SETTINGS_CACHE_KEY, setting, SETTINGS_CACHE_TTL);
        return setting;
    }
    static async clearSystemSettingCache() {
        await Promise.all([
            cache_1.CacheService.del(SYSTEM_SETTINGS_CACHE_KEY),
            cache_1.CacheService.delByPattern("payroll-cycles:*"),
        ]);
    }
    static async getRolePermissions() {
        const setting = await this.getSystemSettingCached();
        return (0, role_permissions_1.normalizeRolePermissions)(setting.rolePermissions);
    }
    static async updateRolePermissions(rolePermissions) {
        const normalized = (0, role_permissions_1.normalizeRolePermissions)(rolePermissions);
        const setting = await settings_repository_1.SettingsRepository.update({
            rolePermissions: normalized,
        });
        await this.clearSystemSettingCache();
        return (0, role_permissions_1.normalizeRolePermissions)(setting.rolePermissions);
    }
    static async updateSettings(data) {
        if (Object.keys(data).length === 0) {
            throw new Error("At least one setting field is required");
        }
        const previousTimezone = (0, timezone_1.getOrganizationTimezone)();
        const organizationTimezone = data.organizationTimezone
            ? (0, timezone_1.getValidTimezone)(data.organizationTimezone, previousTimezone)
            : undefined;
        const setting = await settings_repository_1.SettingsRepository.update({
            ...data,
            ...(organizationTimezone && { organizationTimezone }),
        });
        await this.clearSystemSettingCache();
        (0, timezone_1.setOrganizationTimezone)(setting.organizationTimezone);
        await (0, timezone_sync_1.publishOrganizationTimezone)(setting.organizationTimezone).catch((error) => {
            logger_1.logger.warn({ error }, "Failed to publish organization timezone update");
        });
        if (organizationTimezone && organizationTimezone !== previousTimezone) {
            await system_restart_service_1.SystemRestartService.requireRestart("Organization timezone changed. Restart services to reschedule background cron jobs.");
        }
        return setting;
    }
    static async listWorkHourSettings(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = cache_1.CacheService.buildKey(WORK_HOUR_SETTINGS_READ_CACHE_PREFIX, page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [data, total] = await settings_repository_1.SettingsRepository.listWorkHourSettings({
            skip,
            take,
        });
        const result = {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, WORK_HOUR_SETTINGS_READ_CACHE_TTL);
        return result;
    }
    static async createWorkHourSetting(data, createdById) {
        const workStartTime = (0, overtime_service_1.normalizeTime)(data.workStartTime);
        const workEndTime = (0, overtime_service_1.normalizeTime)(data.workEndTime);
        const effectiveFromDate = (0, overtime_service_1.parseDateOnly)(data.effectiveFromDate);
        const standardMinutes = (0, overtime_service_1.getStandardMinutes)(workStartTime, workEndTime);
        if (standardMinutes <= 0 || standardMinutes > 24 * 60) {
            throw new Error("Standard working hours must be between 1 minute and 24 hours");
        }
        const duplicate = await settings_repository_1.SettingsRepository.findWorkHourSettingByEffectiveDate(effectiveFromDate);
        if (duplicate) {
            throw new Error("Work-hour setting already exists for effective date");
        }
        const setting = await settings_repository_1.SettingsRepository.createWorkHourSetting({
            workStartTime,
            workEndTime,
            standardMinutes,
            effectiveFromDate,
            note: data.note ?? null,
            createdById: createdById ?? null,
        });
        await Promise.all([
            cache_1.CacheService.delByPattern("work-hours:*"),
            cache_1.CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
        ]);
        return setting;
    }
    static async updateWorkHourSetting(id, data) {
        const existing = await settings_repository_1.SettingsRepository.findWorkHourSetting(id);
        if (!existing) {
            throw new Error("Work-hour setting not found");
        }
        const workStartTime = data.workStartTime
            ? (0, overtime_service_1.normalizeTime)(data.workStartTime)
            : existing.workStartTime;
        const workEndTime = data.workEndTime
            ? (0, overtime_service_1.normalizeTime)(data.workEndTime)
            : existing.workEndTime;
        const standardMinutes = (0, overtime_service_1.getStandardMinutes)(workStartTime, workEndTime);
        const effectiveFromDate = data.effectiveFromDate
            ? (0, overtime_service_1.parseDateOnly)(data.effectiveFromDate)
            : undefined;
        if (effectiveFromDate) {
            const duplicate = await settings_repository_1.SettingsRepository.findWorkHourSettingByEffectiveDate(effectiveFromDate);
            if (duplicate && duplicate.id !== id) {
                throw new Error("Work-hour setting already exists for effective date");
            }
        }
        const setting = await settings_repository_1.SettingsRepository.updateWorkHourSetting(id, {
            ...(data.workStartTime && { workStartTime }),
            ...(data.workEndTime && { workEndTime }),
            ...(data.workStartTime || data.workEndTime ? { standardMinutes } : {}),
            ...(effectiveFromDate && { effectiveFromDate }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            ...(Object.prototype.hasOwnProperty.call(data, "note") && {
                note: data.note ?? null,
            }),
        });
        await Promise.all([
            cache_1.CacheService.delByPattern("work-hours:*"),
            cache_1.CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
        ]);
        return setting;
    }
    static async deleteWorkHourSetting(id) {
        const existing = await settings_repository_1.SettingsRepository.findWorkHourSetting(id);
        if (!existing) {
            throw new Error("Work-hour setting not found");
        }
        const setting = await settings_repository_1.SettingsRepository.deleteWorkHourSetting(id);
        await Promise.all([
            cache_1.CacheService.delByPattern("work-hours:*"),
            cache_1.CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
        ]);
        return setting;
    }
}
exports.SettingsService = SettingsService;
//# sourceMappingURL=settings.service.js.map