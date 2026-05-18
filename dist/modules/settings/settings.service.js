"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const settings_repository_1 = require("./settings.repository");
const overtime_service_1 = require("../../services/overtime.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
class SettingsService {
    static async getSettings() {
        return settings_repository_1.SettingsRepository.get();
    }
    static async updateSettings(data) {
        if (Object.keys(data).length === 0) {
            throw new Error("At least one setting field is required");
        }
        return settings_repository_1.SettingsRepository.update(data);
    }
    static async listWorkHourSettings(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [data, total] = await settings_repository_1.SettingsRepository.listWorkHourSettings({
            skip,
            take,
        });
        return {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
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
        return settings_repository_1.SettingsRepository.createWorkHourSetting({
            workStartTime,
            workEndTime,
            standardMinutes,
            effectiveFromDate,
            note: data.note ?? null,
            createdById: createdById ?? null,
        });
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
        return settings_repository_1.SettingsRepository.updateWorkHourSetting(id, {
            ...(data.workStartTime && { workStartTime }),
            ...(data.workEndTime && { workEndTime }),
            ...(data.workStartTime || data.workEndTime ? { standardMinutes } : {}),
            ...(effectiveFromDate && { effectiveFromDate }),
            ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
            ...(Object.prototype.hasOwnProperty.call(data, "note") && {
                note: data.note ?? null,
            }),
        });
    }
    static async deleteWorkHourSetting(id) {
        const existing = await settings_repository_1.SettingsRepository.findWorkHourSetting(id);
        if (!existing) {
            throw new Error("Work-hour setting not found");
        }
        return settings_repository_1.SettingsRepository.deleteWorkHourSetting(id);
    }
}
exports.SettingsService = SettingsService;
//# sourceMappingURL=settings.service.js.map