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
export declare const createWorkHourSettingSchema: z.ZodObject<{
    body: z.ZodObject<{
        workStartTime: z.ZodString;
        workEndTime: z.ZodString;
        effectiveFromDate: z.ZodString;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateWorkHourSettingSchema: z.ZodObject<{
    body: z.ZodObject<{
        workStartTime: z.ZodOptional<z.ZodString>;
        workEndTime: z.ZodOptional<z.ZodString>;
        effectiveFromDate: z.ZodOptional<z.ZodString>;
        isActive: z.ZodOptional<z.ZodBoolean>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=settings.validator.d.ts.map