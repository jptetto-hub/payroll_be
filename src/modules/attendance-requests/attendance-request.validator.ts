import { z } from "zod";
import { AttendanceRequestType, AttendanceStatus } from "@prisma/client";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const requestItemSchema = z.object({
  attendanceDate: z
    .string()
    .regex(dateOnlyRegex, "attendanceDate must be in YYYY-MM-DD format"),
  requestedStatus: z.nativeEnum(
    AttendanceStatus,
    "requestedStatus must be PRESENT, ABSENT, or HALF_DAY",
  ),
  requestType: z.nativeEnum(
    AttendanceRequestType,
    "requestType must be ADD or EDIT",
  ),
  reason: z.string().min(5, "Reason is required").max(250),
});

export const createAttendanceRequestSchema = z.object({
  body: z
    .object({
      requests: z
        .array(requestItemSchema)
        .min(1, "At least one attendance request is required")
        .max(31, "Maximum 31 attendance requests allowed at once"),
    })
    .refine(
      (data) => {
        const dates = data.requests.map((item) => item.attendanceDate);
        return dates.length === new Set(dates).size;
      },
      {
        message: "Duplicate attendance dates are not allowed in same request",
      },
    ),
});

export const rejectAttendanceRequestSchema = z.object({
  body: z.object({
    rejectionReason: z.string().min(5, "Rejection reason is required").max(250),
  }),
});

export const attendanceRequestDateFilterSchema = z.object({
  query: z.object({
    from: z.string().regex(dateOnlyRegex).optional(),
    to: z.string().regex(dateOnlyRegex).optional(),
    employeeId: z.union([z.string().uuid(), z.literal("all")]).optional(),
  }),
});

export const attendanceRequestDecisionSchema = z.object({
  body: z
    .object({
      requestIds: z.array(z.string().uuid()).min(1),
      action: z.enum(["APPROVE", "REJECT"]),
      rejectionReason: z.string().min(5).max(250).optional(),
    })
    .refine((data) => data.action === "APPROVE" || !!data.rejectionReason, {
      message: "rejectionReason is required when action is REJECT",
    }),
});
