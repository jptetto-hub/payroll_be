import { z } from "zod";
export declare const salaryCalculationPreviewSchema: z.ZodObject<{
    body: z.ZodObject<{
        employeeId: z.ZodString;
        periodStart: z.ZodString;
        periodEnd: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=salary-calculation.validator.d.ts.map