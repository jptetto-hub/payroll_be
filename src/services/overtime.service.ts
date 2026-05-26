import { prisma } from "../config/prisma";
import { CacheService } from "../utils/cache";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const db = prisma as any;

const roundHours = (value: number) => Math.round(value * 100) / 100;
const isSunday = (date: Date) => date.getUTCDay() === 0;

export const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

export const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const normalizeTime = (value: string) => {
  if (!timeRegex.test(value)) {
    throw new Error("Time must be in HH:mm format");
  }

  return value;
};

export const getStandardMinutes = (workStartTime: string, workEndTime: string) => {
  normalizeTime(workStartTime);
  normalizeTime(workEndTime);

  const [startHour = 0, startMinute = 0] = workStartTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = workEndTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end <= start) {
    end += 24 * 60;
  }

  return end - start;
};

const dateAtTime = (date: Date, time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  result.setUTCMinutes(hours * 60 + minutes);

  return result;
};

export class OvertimeService {
  static async getSettingForDate(date: Date) {
    const defaultEffectiveFromDate = new Date("2000-01-01T00:00:00.000Z");
    const setting = await db.workHourSetting.findFirst({
      where: {
        effectiveFromDate: {
          lte: date,
        },
        isActive: true,
      },
      orderBy: {
        effectiveFromDate: "desc",
      },
    });

    if (setting) return setting;

    const existingDefault = await db.workHourSetting.findUnique({
      where: {
        effectiveFromDate: defaultEffectiveFromDate,
      },
    });

    if (existingDefault) {
      return db.workHourSetting.update({
        where: {
          id: existingDefault.id,
        },
        data: {
          isActive: true,
        },
      });
    }

    try {
      return await db.workHourSetting.create({
        data: {
          workStartTime: "09:00",
          workEndTime: "17:00",
          standardMinutes: 480,
          effectiveFromDate: defaultEffectiveFromDate,
          isActive: true,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") {
        throw error;
      }

      const defaultSetting = await db.workHourSetting.findUnique({
        where: {
          effectiveFromDate: defaultEffectiveFromDate,
        },
      });

      if (!defaultSetting) throw error;

      return defaultSetting;
    }
  }

  static async getSettingsForDateRange(periodStart: Date, periodEnd: Date) {
    const key = CacheService.buildKey(
      "work-hours",
      formatDateOnly(periodStart),
      formatDateOnly(periodEnd),
    );
    const cached = await CacheService.get<any[]>(key);

    if (cached) {
      return cached.map((setting) => ({
        ...setting,
        effectiveFromDate: new Date(setting.effectiveFromDate),
        createdAt: setting.createdAt ? new Date(setting.createdAt) : setting.createdAt,
        updatedAt: setting.updatedAt ? new Date(setting.updatedAt) : setting.updatedAt,
      }));
    }

    await this.getSettingForDate(periodStart);

    const settings = await db.workHourSetting.findMany({
      where: {
        isActive: true,
        effectiveFromDate: {
          lte: periodEnd,
        },
      },
      orderBy: {
        effectiveFromDate: "asc",
      },
    });

    await CacheService.set(key, settings, 60 * 10);

    return settings;
  }

  static resolveSettingFromList(settings: any[], date: Date) {
    let selected = settings[0];

    for (const setting of settings) {
      if (setting.effectiveFromDate <= date) {
        selected = setting;
      } else {
        break;
      }
    }

    if (!selected) {
      throw new Error("Work hour setting not found");
    }

    return selected;
  }

  static async calculateForAttendance(params: {
    attendanceDate: Date;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    otStartTime?: Date | null;
    otEndTime?: Date | null;
    otManualOverride?: boolean;
    otHours?: number | null;
    otOverrideReason?: string | null;
    setting?: any;
  }) {
    const setting =
      params.setting ?? (await this.getSettingForDate(params.attendanceDate));
    const standardStart = dateAtTime(params.attendanceDate, setting.workStartTime);
    let standardEnd = dateAtTime(params.attendanceDate, setting.workEndTime);

    if (standardEnd <= standardStart) {
      standardEnd = new Date(standardEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const checkInTime = params.checkInTime ?? null;
    const checkOutTime = params.checkOutTime ?? null;
    const otStartTime = params.otStartTime ?? null;
    const otEndTime = params.otEndTime ?? null;
    const manual = Boolean(params.otManualOverride);
    const restDay = isSunday(params.attendanceDate);

    if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
      throw new Error("Check-out time must be after check-in time");
    }

    if (Boolean(otStartTime) !== Boolean(otEndTime)) {
      throw new Error("Both OT start time and OT end time are required");
    }

    if (otStartTime && otEndTime && otEndTime <= otStartTime) {
      throw new Error("OT end time must be after OT start time");
    }

    if (
      !restDay &&
      otStartTime &&
      otEndTime &&
      otStartTime < standardEnd &&
      otEndTime > standardStart
    ) {
      throw new Error(
        `OT time cannot overlap regular working hours ${setting.workStartTime} to ${setting.workEndTime}`,
      );
    }

    if (manual) {
      const otHours = roundHours(Number(params.otHours ?? 0));

      if (otHours < 0) {
        throw new Error("Manual OT hours cannot be negative");
      }

      if (otHours > 0 && !params.otOverrideReason?.trim()) {
        throw new Error("Manual OT override reason is required");
      }

      return {
        otHours,
        otStartTime,
        otEndTime,
        otManualOverride: true,
        otOverrideReason: params.otOverrideReason?.trim() ?? null,
        otBreakdown: {
          mode: "MANUAL",
          workHourSettingId: setting.id,
          workStartTime: setting.workStartTime,
          workEndTime: setting.workEndTime,
          standardMinutes: setting.standardMinutes,
          standardStart: standardStart.toISOString(),
          standardEnd: standardEnd.toISOString(),
        },
      };
    }

    const resolvedOtStart =
      otStartTime ??
      (restDay
        ? checkInTime
        : checkInTime && checkInTime >= standardEnd
          ? checkInTime
          : standardEnd);
    const resolvedOtEnd = otEndTime ?? checkOutTime;
    const isExplicitOtRange = Boolean(otStartTime && otEndTime);
    const outsideWorkingHours =
      restDay ||
      isExplicitOtRange ||
      Boolean(resolvedOtStart && resolvedOtStart >= standardEnd);
    const validRange =
      Boolean(resolvedOtStart) &&
      Boolean(resolvedOtEnd) &&
      resolvedOtEnd! > resolvedOtStart! &&
      outsideWorkingHours;
    const otHours = validRange
      ? roundHours((resolvedOtEnd!.getTime() - resolvedOtStart!.getTime()) / 3600000)
      : 0;

    return {
      otHours,
      otStartTime: otHours > 0 ? resolvedOtStart : otStartTime,
      otEndTime: otHours > 0 ? resolvedOtEnd : otEndTime,
      otManualOverride: false,
      otOverrideReason: null,
      otBreakdown: {
        mode: "AUTO",
        workHourSettingId: setting.id,
        workStartTime: setting.workStartTime,
        workEndTime: setting.workEndTime,
        standardMinutes: setting.standardMinutes,
        standardStart: standardStart.toISOString(),
        standardEnd: standardEnd.toISOString(),
      },
    };
  }
}
