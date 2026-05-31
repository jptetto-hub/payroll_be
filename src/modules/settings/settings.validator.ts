import { z } from "zod";
import { WeekStartsOn } from "@prisma/client";
import { getValidTimezone } from "../../config/timezone";

const timezoneSchema = z.string().min(1).max(100).refine((value) => {
  try {
    getValidTimezone(value, "UTC");
    return true;
  } catch {
    return false;
  }
}, "organizationTimezone must be a valid IANA timezone");

export const updateSettingsSchema = z.object({
  body: z.object({
    weekStartsOn: z.nativeEnum(WeekStartsOn).optional(),
    monthlyPayrollDay: z.number().int().min(1).max(31).nullable().optional(),
    autoPayrollEnabled: z.boolean().optional(),
    organizationTimezone: timezoneSchema.optional(),
  }),
});

export const updateOrganizationTimezoneSchema = z.object({
  body: z.object({
    organizationTimezone: timezoneSchema,
  }),
});

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createWorkHourSettingSchema = z.object({
  body: z.object({
    workStartTime: z.string().regex(timeRegex, "workStartTime must be HH:mm"),
    workEndTime: z.string().regex(timeRegex, "workEndTime must be HH:mm"),
    effectiveFromDate: z
      .string()
      .regex(dateOnlyRegex, "effectiveFromDate must be YYYY-MM-DD"),
    note: z.string().max(250).nullable().optional(),
  }),
});

export const updateWorkHourSettingSchema = z.object({
  body: z
    .object({
      workStartTime: z
        .string()
        .regex(timeRegex, "workStartTime must be HH:mm")
        .optional(),
      workEndTime: z
        .string()
        .regex(timeRegex, "workEndTime must be HH:mm")
        .optional(),
      effectiveFromDate: z
        .string()
        .regex(dateOnlyRegex, "effectiveFromDate must be YYYY-MM-DD")
        .optional(),
      isActive: z.boolean().optional(),
      note: z.string().max(250).nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one work-hour field is required",
    }),
});
