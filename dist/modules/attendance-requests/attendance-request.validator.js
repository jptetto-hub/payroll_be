"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceRequestDecisionSchema = exports.attendanceRequestDateFilterSchema = exports.rejectAttendanceRequestSchema = exports.createAttendanceRequestSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const requestItemSchema = zod_1.z.object({
    attendanceDate: zod_1.z
        .string()
        .regex(dateOnlyRegex, "attendanceDate must be in YYYY-MM-DD format"),
    requestedStatus: zod_1.z.nativeEnum(client_1.AttendanceStatus, "requestedStatus must be PRESENT, ABSENT, or HALF_DAY"),
    requestType: zod_1.z.nativeEnum(client_1.AttendanceRequestType, "requestType must be ADD or EDIT"),
    reason: zod_1.z.string().min(5, "Reason is required").max(250),
});
exports.createAttendanceRequestSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        requests: zod_1.z
            .array(requestItemSchema)
            .min(1, "At least one attendance request is required")
            .max(31, "Maximum 31 attendance requests allowed at once"),
    })
        .refine((data) => {
        const dates = data.requests.map((item) => item.attendanceDate);
        return dates.length === new Set(dates).size;
    }, {
        message: "Duplicate attendance dates are not allowed in same request",
    }),
});
exports.rejectAttendanceRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        rejectionReason: zod_1.z.string().min(5, "Rejection reason is required").max(250),
    }),
});
exports.attendanceRequestDateFilterSchema = zod_1.z.object({
    query: zod_1.z.object({
        from: zod_1.z.string().regex(dateOnlyRegex).optional(),
        to: zod_1.z.string().regex(dateOnlyRegex).optional(),
        employeeId: zod_1.z.union([zod_1.z.string().uuid(), zod_1.z.literal("all")]).optional(),
    }),
});
exports.attendanceRequestDecisionSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        requestIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
        action: zod_1.z.enum(["APPROVE", "REJECT"]),
        rejectionReason: zod_1.z.string().min(5).max(250).optional(),
    })
        .refine((data) => data.action === "APPROVE" || !!data.rejectionReason, {
        message: "rejectionReason is required when action is REJECT",
    }),
});
//# sourceMappingURL=attendance-request.validator.js.map