import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const attendanceDateSchema = z
  .string()
  .regex(dateOnlyRegex, "Date must be in YYYY-MM-DD format");

const employeeIdSchema = z.string().uuid("Valid employeeId is required");

export const createAttendanceSchema = z.object({
  body: z.object({
    employeeId: employeeIdSchema,
    date: attendanceDateSchema,
    status: z.nativeEnum(
      AttendanceStatus,
      "Status must be PRESENT, ABSENT, or HALF_DAY",
    ),
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
  }),
});

export const rangeQuerySchema = z.object({
  query: z.object({
    from: attendanceDateSchema,
    to: attendanceDateSchema,
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
