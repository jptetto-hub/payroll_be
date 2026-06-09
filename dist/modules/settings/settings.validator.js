"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWorkHourSettingSchema = exports.createWorkHourSettingSchema = exports.updateRolePermissionsSchema = exports.updateOrganizationTimezoneSchema = exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const timezone_1 = require("../../config/timezone");
const role_permissions_1 = require("./role-permissions");
const timezoneSchema = zod_1.z.string().min(1).max(100).refine((value) => {
    try {
        (0, timezone_1.getValidTimezone)(value, "UTC");
        return true;
    }
    catch {
        return false;
    }
}, "organizationTimezone must be a valid IANA timezone");
exports.updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        weekStartsOn: zod_1.z.nativeEnum(client_1.WeekStartsOn).optional(),
        monthlyPayrollDay: zod_1.z.number().int().min(1).max(31).nullable().optional(),
        autoPayrollEnabled: zod_1.z.boolean().optional(),
        organizationTimezone: timezoneSchema.optional(),
    }),
});
exports.updateOrganizationTimezoneSchema = zod_1.z.object({
    body: zod_1.z.object({
        organizationTimezone: timezoneSchema,
    }),
});
const rolePermissionSchema = zod_1.z.object(Object.fromEntries(role_permissions_1.configurablePermissionKeys.map((permission) => [permission, zod_1.z.boolean()])));
exports.updateRolePermissionsSchema = zod_1.z.object({
    body: zod_1.z.object({
        ADMIN: rolePermissionSchema,
        USER: rolePermissionSchema,
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