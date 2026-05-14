import { z } from "zod";
export declare const createAttendanceRequestSchema: z.ZodObject<{
    body: z.ZodObject<{
        requests: z.ZodArray<z.ZodObject<{
            attendanceDate: z.ZodString;
            requestedStatus: z.ZodEnum<{
                PRESENT: "PRESENT";
                ABSENT: "ABSENT";
                HALF_DAY: "HALF_DAY";
            }>;
            requestType: z.ZodEnum<{
                ADD: "ADD";
                EDIT: "EDIT";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const rejectAttendanceRequestSchema: z.ZodObject<{
    body: z.ZodObject<{
        rejectionReason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const attendanceRequestDateFilterSchema: z.ZodObject<{
    query: z.ZodObject<{
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
        employeeId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"all">]>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const attendanceRequestDecisionSchema: z.ZodObject<{
    body: z.ZodObject<{
        requestIds: z.ZodArray<z.ZodString>;
        action: z.ZodEnum<{
            APPROVE: "APPROVE";
            REJECT: "REJECT";
        }>;
        rejectionReason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=attendance-request.validator.d.ts.map