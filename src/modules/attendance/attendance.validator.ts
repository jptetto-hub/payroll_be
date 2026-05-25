import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const attendanceDateSchema = z
  .string()
  .regex(dateOnlyRegex, "Date must be in YYYY-MM-DD format");

const employeeIdSchema = z.string().uuid("Valid employeeId is required");
const isoDateTimeSchema = z
  .string()
  .datetime("Time must be a valid ISO date-time")
  .optional()
  .nullable();

const otFieldsSchema = {
  checkInTime: isoDateTimeSchema,
  checkOutTime: isoDateTimeSchema,
  otStartTime: isoDateTimeSchema,
  otEndTime: isoDateTimeSchema,
  otHours: z.number().min(0).max(24).optional().nullable(),
  otManualOverride: z.boolean().optional(),
  otOverrideReason: z.string().min(5).max(250).optional().nullable(),
};

export const createAttendanceSchema = z.object({
  body: z.object({
    employeeId: employeeIdSchema,
    date: attendanceDateSchema,
    status: z.nativeEnum(
      AttendanceStatus,
      "Status must be PRESENT, ABSENT, or HALF_DAY",
    ),
    ...otFieldsSchema,
  }),
});

export const bulkAttendanceSchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          employeeId: employeeIdSchema,
          date: attendanceDateSchema,
          status: z.nativeEnum(AttendanceStatus),
          ...otFieldsSchema,
        }),
      )
      .min(1, "At least one attendance record is required")
      .max(100, "Maximum 100 records allowed at once"),
  }),
});

export const updateAttendanceSchema = z.object({
  body: z.object({
    status: z.nativeEnum(AttendanceStatus),
    reason: z.string().min(5, "Update reason is required").max(250),
    ...otFieldsSchema,
  }),
});

export const rangeQuerySchema = z.object({
  query: z.object({
    from: attendanceDateSchema,
    to: attendanceDateSchema,
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const bulkUpdateAttendanceSchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          attendanceId: z.string().uuid("Valid attendanceId is required"),
          status: z.nativeEnum(AttendanceStatus),
          reason: z.string().min(5).max(250),
          ...otFieldsSchema,
        }),
      )
      .min(1, "At least one attendance record is required")
      .max(100, "Maximum 100 records allowed at once"),
  }),
});

export const bulkDeleteAttendanceSchema = z.object({
  body: z.object({
    attendanceIds: z
      .array(z.string().uuid("Valid attendanceId is required"))
      .min(1, "At least one attendanceId is required")
      .max(100, "Maximum 100 records can be deleted at once"),
    reason: z.string().min(5, "Delete reason is required").max(250),
  }),
});
