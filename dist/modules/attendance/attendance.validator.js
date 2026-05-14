"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteAttendanceSchema = exports.bulkUpdateAttendanceSchema = exports.rangeQuerySchema = exports.updateAttendanceSchema = exports.bulkAttendanceSchema = exports.createAttendanceSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const attendanceDateSchema = zod_1.z
    .string()
    .regex(dateOnlyRegex, "Date must be in YYYY-MM-DD format");
const employeeIdSchema = zod_1.z.string().uuid("Valid employeeId is required");
exports.createAttendanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: employeeIdSchema,
        date: attendanceDateSchema,
        status: zod_1.z.nativeEnum(client_1.AttendanceStatus, "Status must be PRESENT, ABSENT, or HALF_DAY"),
    }),
});
exports.bulkAttendanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        records: zod_1.z
            .array(zod_1.z.object({
            employeeId: employeeIdSchema,
            date: attendanceDateSchema,
            status: zod_1.z.nativeEnum(client_1.AttendanceStatus),
        }))
            .min(1, "At least one attendance record is required")
            .max(100, "Maximum 100 records allowed at once"),
    }),
});
exports.updateAttendanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(client_1.AttendanceStatus),
        reason: zod_1.z.string().min(5, "Update reason is required").max(250),
    }),
});
exports.rangeQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        from: attendanceDateSchema,
        to: attendanceDateSchema,
    }),
});
exports.bulkUpdateAttendanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        records: zod_1.z
            .array(zod_1.z.object({
            attendanceId: zod_1.z.string().uuid("Valid attendanceId is required"),
            status: zod_1.z.nativeEnum(client_1.AttendanceStatus),
            reason: zod_1.z.string().min(5).max(250),
        }))
            .min(1, "At least one attendance record is required")
            .max(100, "Maximum 100 records allowed at once"),
    }),
});
exports.bulkDeleteAttendanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        attendanceIds: zod_1.z
            .array(zod_1.z.string().uuid("Valid attendanceId is required"))
            .min(1, "At least one attendanceId is required")
            .max(100, "Maximum 100 records can be deleted at once"),
        reason: zod_1.z.string().min(5, "Delete reason is required").max(250),
    }),
});
//# sourceMappingURL=attendance.validator.js.map