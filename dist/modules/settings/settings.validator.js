"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWorkHourSettingSchema = exports.createWorkHourSettingSchema = exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        weekStartsOn: zod_1.z.nativeEnum(client_1.WeekStartsOn).optional(),
        monthlyPayrollDay: zod_1.z.number().int().min(1).max(31).nullable().optional(),
        autoPayrollEnabled: zod_1.z.boolean().optional(),
    }),
});
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
exports.createWorkHourSettingSchema = zod_1.z.object({
    body: zod_1.z.object({
        workStartTime: zod_1.z.string().regex(timeRegex, "workStartTime must be HH:mm"),
        workEndTime: zod_1.z.string().regex(timeRegex, "workEndTime must be HH:mm"),
        effectiveFromDate: zod_1.z
            .string()
            .regex(dateOnlyRegex, "effectiveFromDate must be YYYY-MM-DD"),
        note: zod_1.z.string().max(250).nullable().optional(),
    }),
});
exports.updateWorkHourSettingSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        workStartTime: zod_1.z
            .string()
            .regex(timeRegex, "workStartTime must be HH:mm")
            .optional(),
        workEndTime: zod_1.z
            .string()
            .regex(timeRegex, "workEndTime must be HH:mm")
            .optional(),
        effectiveFromDate: zod_1.z
            .string()
            .regex(dateOnlyRegex, "effectiveFromDate must be YYYY-MM-DD")
            .optional(),
        isActive: zod_1.z.boolean().optional(),
        note: zod_1.z.string().max(250).nullable().optional(),
    })
        .refine((value) => Object.keys(value).length > 0, {
        message: "At least one work-hour field is required",
    }),
});
//# sourceMappingURL=settings.validator.js.map