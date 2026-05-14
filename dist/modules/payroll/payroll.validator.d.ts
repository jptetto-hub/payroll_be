import { z } from "zod";
export declare const generatePayrollSchema: z.ZodObject<{
    body: z.ZodObject<{
        employeeId: z.ZodString;
        periodStart: z.ZodString;
        periodEnd: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const deletePayrollSchema: z.ZodObject<{
    body: z.ZodObject<{
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const recalculatePayrollSchema: z.ZodObject<{
    body: z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=payroll.validator.d.ts.map