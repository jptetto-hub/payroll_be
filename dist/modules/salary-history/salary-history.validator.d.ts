import { z } from "zod";
export declare const createSalaryHistorySchema: z.ZodObject<{
    body: z.ZodObject<{
        employeeId: z.ZodString;
        salaryAmount: z.ZodCoercedNumber<unknown>;
        effectiveFrom: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateSalaryHistorySchema: z.ZodObject<{
    body: z.ZodObject<{
        salaryAmount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        effectiveFrom: z.ZodOptional<z.ZodString>;
        correctionReason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const resolveSalarySchema: z.ZodObject<{
    query: z.ZodObject<{
        date: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=salary-history.validator.d.ts.map