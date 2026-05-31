import { SettingsRepository } from "./settings.repository";
import {
  getStandardMinutes,
  normalizeTime,
  parseDateOnly,
} from "../../services/overtime.service";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { CacheService } from "../../utils/cache";
import {
  getOrganizationTimezone,
  getValidTimezone,
  setOrganizationTimezone,
} from "../../config/timezone";
import { SystemRestartService } from "../maintenance/system-restart.service";
import { publishOrganizationTimezone } from "../../config/timezone-sync";
import { logger } from "../../config/logger";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
const WORK_HOUR_SETTINGS_READ_CACHE_PREFIX = "work-hour-settings-read";
const WORK_HOUR_SETTINGS_READ_CACHE_TTL = 60 * 5;

export class SettingsService {
  static async initializeOrganizationTimezone() {
    const setting = await SettingsRepository.get();
    return setOrganizationTimezone(setting.organizationTimezone);
  }

  static async getSettings() {
    return this.getSystemSettingCached();
  }

  static async getSystemSettingCached() {
    const cached = await CacheService.get<any>(SYSTEM_SETTINGS_CACHE_KEY);

    if (cached?.organizationTimezone) {
      return cached;
    }

    const setting = await SettingsRepository.get();

    await CacheService.set(
      SYSTEM_SETTINGS_CACHE_KEY,
      setting,
      SETTINGS_CACHE_TTL,
    );

    return setting;
  }

  static async clearSystemSettingCache() {
    await Promise.all([
      CacheService.del(SYSTEM_SETTINGS_CACHE_KEY),
      CacheService.delByPattern("payroll-cycles:*"),
    ]);
  }

  static async updateSettings(data: {
    weekStartsOn?: "MONDAY" | "SUNDAY";
    monthlyPayrollDay?: number | null;
    autoPayrollEnabled?: boolean;
    organizationTimezone?: string;
  }) {
    if (Object.keys(data).length === 0) {
      throw new Error("At least one setting field is required");
    }

    const previousTimezone = getOrganizationTimezone();
    const organizationTimezone = data.organizationTimezone
      ? getValidTimezone(data.organizationTimezone, previousTimezone)
      : undefined;
    const setting = await SettingsRepository.update({
      ...data,
      ...(organizationTimezone && { organizationTimezone }),
    });

    await this.clearSystemSettingCache();
    setOrganizationTimezone(setting.organizationTimezone);
    await publishOrganizationTimezone(setting.organizationTimezone).catch(
      (error) => {
        logger.warn({ error }, "Failed to publish organization timezone update");
      },
    );

    if (organizationTimezone && organizationTimezone !== previousTimezone) {
      await SystemRestartService.requireRestart(
        "Organization timezone changed. Restart services to reschedule background cron jobs.",
      );
    }

    return setting;
  }

  static async listWorkHourSettings(query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const cacheKey = CacheService.buildKey(
      WORK_HOUR_SETTINGS_READ_CACHE_PREFIX,
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [data, total] = await SettingsRepository.listWorkHourSettings({
      skip,
      take,
    });

    const result = {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(
      cacheKey,
      result,
      WORK_HOUR_SETTINGS_READ_CACHE_TTL,
    );

    return result;
  }

  static async createWorkHourSetting(
    data: {
      workStartTime: string;
      workEndTime: string;
      effectiveFromDate: string;
      note?: string | null;
    },
    createdById?: string,
  ) {
    const workStartTime = normalizeTime(data.workStartTime);
    const workEndTime = normalizeTime(data.workEndTime);
    const effectiveFromDate = parseDateOnly(data.effectiveFromDate);
    const standardMinutes = getStandardMinutes(workStartTime, workEndTime);

    if (standardMinutes <= 0 || standardMinutes > 24 * 60) {
      throw new Error("Standard working hours must be between 1 minute and 24 hours");
    }

    const duplicate =
      await SettingsRepository.findWorkHourSettingByEffectiveDate(
        effectiveFromDate,
      );

    if (duplicate) {
      throw new Error("Work-hour setting already exists for effective date");
    }

    const setting = await SettingsRepository.createWorkHourSetting({
      workStartTime,
      workEndTime,
      standardMinutes,
      effectiveFromDate,
      note: data.note ?? null,
      createdById: createdById ?? null,
    });

    await Promise.all([
      CacheService.delByPattern("work-hours:*"),
      CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
    ]);

    return setting;
  }

  static async updateWorkHourSetting(
    id: string,
    data: {
      workStartTime?: string;
      workEndTime?: string;
      effectiveFromDate?: string;
      isActive?: boolean;
      note?: string | null;
    },
  ) {
    const existing = await SettingsRepository.findWorkHourSetting(id);

    if (!existing) {
      throw new Error("Work-hour setting not found");
    }

    const workStartTime = data.workStartTime
      ? normalizeTime(data.workStartTime)
      : existing.workStartTime;
    const workEndTime = data.workEndTime
      ? normalizeTime(data.workEndTime)
      : existing.workEndTime;
    const standardMinutes = getStandardMinutes(workStartTime, workEndTime);
    const effectiveFromDate = data.effectiveFromDate
      ? parseDateOnly(data.effectiveFromDate)
      : undefined;

    if (effectiveFromDate) {
      const duplicate =
        await SettingsRepository.findWorkHourSettingByEffectiveDate(
          effectiveFromDate,
        );

      if (duplicate && duplicate.id !== id) {
        throw new Error("Work-hour setting already exists for effective date");
      }
    }

    const setting = await SettingsRepository.updateWorkHourSetting(id, {
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
      CacheService.delByPattern("work-hours:*"),
      CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
    ]);

    return setting;
  }

  static async deleteWorkHourSetting(id: string) {
    const existing = await SettingsRepository.findWorkHourSetting(id);

    if (!existing) {
      throw new Error("Work-hour setting not found");
    }

    const setting = await SettingsRepository.deleteWorkHourSetting(id);

    await Promise.all([
      CacheService.delByPattern("work-hours:*"),
      CacheService.delByPattern(`${WORK_HOUR_SETTINGS_READ_CACHE_PREFIX}:*`),
    ]);

    return setting;
  }
}
