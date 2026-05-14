import { z } from "zod";
export declare const updateSettingsSchema: z.ZodObject<{
    body: z.ZodObject<{
        weekStartsOn: z.ZodOptional<z.ZodEnum<{
            MONDAY: "MONDAY";
            SUNDAY: "SUNDAY";
        }>>;
        monthlyPayrollDay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        autoPayrollEnabled: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=settings.validator.d.ts.map