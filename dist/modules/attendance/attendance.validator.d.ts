import { z } from "zod";
export declare const createAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        employeeId: z.ZodString;
        date: z.ZodString;
        status: z.ZodEnum<{
            PRESENT: "PRESENT";
            ABSENT: "ABSENT";
            HALF_DAY: "HALF_DAY";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const bulkAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        records: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            date: z.ZodString;
            status: z.ZodEnum<{
                PRESENT: "PRESENT";
                ABSENT: "ABSENT";
                HALF_DAY: "HALF_DAY";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        status: z.ZodEnum<{
            PRESENT: "PRESENT";
            ABSENT: "ABSENT";
            HALF_DAY: "HALF_DAY";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const rangeQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const bulkUpdateAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        records: z.ZodArray<z.ZodObject<{
            attendanceId: z.ZodString;
            status: z.ZodEnum<{
                PRESENT: "PRESENT";
                ABSENT: "ABSENT";
                HALF_DAY: "HALF_DAY";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const bulkDeleteAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        attendanceIds: z.ZodArray<z.ZodString>;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=attendance.validator.d.ts.map