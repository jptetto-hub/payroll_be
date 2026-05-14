import { z } from "zod";
export declare const createAdvanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        employeeId: z.ZodString;
        amount: z.ZodCoercedNumber<unknown>;
        date: z.ZodString;
        deductionCycleStartDate: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateAdvanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        amount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        date: z.ZodOptional<z.ZodString>;
        deductionCycleStartDate: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const cycleQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        cycleStartDate: z.ZodString;
        cycleEndDate: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const deleteAdvanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=advance.validator.d.ts.map