"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OvertimeService = exports.getStandardMinutes = exports.normalizeTime = exports.formatDateOnly = exports.parseDateOnly = void 0;
const prisma_1 = require("../config/prisma");
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const db = prisma_1.prisma;
const roundHours = (value) => Math.round(value * 100) / 100;
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
exports.parseDateOnly = parseDateOnly;
const formatDateOnly = (date) => date.toISOString().slice(0, 10);
exports.formatDateOnly = formatDateOnly;
const normalizeTime = (value) => {
    if (!timeRegex.test(value)) {
        throw new Error("Time must be in HH:mm format");
    }
    return value;
};
exports.normalizeTime = normalizeTime;
const getStandardMinutes = (workStartTime, workEndTime) => {
    (0, exports.normalizeTime)(workStartTime);
    (0, exports.normalizeTime)(workEndTime);
    const [startHour = 0, startMinute = 0] = workStartTime.split(":").map(Number);
    const [endHour = 0, endMinute = 0] = workEndTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;
    if (end <= start) {
        end += 24 * 60;
    }
    return end - start;
};
exports.getStandardMinutes = getStandardMinutes;
const dateAtTime = (date, time) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    result.setUTCMinutes(hours * 60 + minutes);
    return result;
};
class OvertimeService {
    static async getSettingForDate(date) {
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
        if (setting)
            return setting;
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
        }
        catch (error) {
            if (error?.code !== "P2002") {
                throw error;
            }
            const defaultSetting = await db.workHourSetting.findUnique({
                where: {
                    effectiveFromDate: defaultEffectiveFromDate,
                },
            });
            if (!defaultSetting)
                throw error;
            return defaultSetting;
        }
    }
    static async calculateForAttendance(params) {
        const setting = await this.getSettingForDate(params.attendanceDate);
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
        if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
            throw new Error("Check-out time must be after check-in time");
        }
        if (Boolean(otStartTime) !== Boolean(otEndTime)) {
            throw new Error("Both OT start time and OT end time are required");
        }
        if (otStartTime && otEndTime && otEndTime <= otStartTime) {
            throw new Error("OT end time must be after OT start time");
        }
        if (otStartTime && otStartTime < standardEnd) {
            throw new Error(`OT start time must be at or after regular work end time ${setting.workEndTime}`);
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
        const resolvedOtStart = otStartTime ??
            (checkInTime && checkInTime >= standardEnd ? checkInTime : standardEnd);
        const resolvedOtEnd = otEndTime ?? checkOutTime;
        const startsAfterShift = resolvedOtStart >= standardEnd;
        const validRange = Boolean(resolvedOtEnd) && resolvedOtEnd > resolvedOtStart && startsAfterShift;
        const otHours = validRange
            ? roundHours((resolvedOtEnd.getTime() - resolvedOtStart.getTime()) / 3600000)
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
exports.OvertimeService = OvertimeService;
//# sourceMappingURL=overtime.service.js.map