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

export class SettingsService {
  static async getSettings() {
    return SettingsRepository.get();
  }

  static async updateSettings(data: {
    weekStartsOn?: "MONDAY" | "SUNDAY";
    monthlyPayrollDay?: number | null;
    autoPayrollEnabled?: boolean;
  }) {
    if (Object.keys(data).length === 0) {
      throw new Error("At least one setting field is required");
    }

    return SettingsRepository.update(data);
  }

  static async listWorkHourSettings(query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const [data, total] = await SettingsRepository.listWorkHourSettings({
      skip,
      take,
    });

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
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

    return SettingsRepository.createWorkHourSetting({
      workStartTime,
      workEndTime,
      standardMinutes,
      effectiveFromDate,
      note: data.note ?? null,
      createdById: createdById ?? null,
    });
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

    return SettingsRepository.updateWorkHourSetting(id, {
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

  static async deleteWorkHourSetting(id: string) {
    const existing = await SettingsRepository.findWorkHourSetting(id);

    if (!existing) {
      throw new Error("Work-hour setting not found");
    }

    return SettingsRepository.deleteWorkHourSetting(id);
  }
}
