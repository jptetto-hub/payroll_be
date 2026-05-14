import { z } from "zod";
export declare const createEmployeeSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodString;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        password: z.ZodString;
        address: z.ZodOptional<z.ZodString>;
        designation: z.ZodString;
        department: z.ZodString;
        joiningDate: z.ZodString;
        salaryType: z.ZodEnum<{
            MONTHLY: "MONTHLY";
            WEEKLY: "WEEKLY";
        }>;
        role: z.ZodDefault<z.ZodEnum<{
            USER: "USER";
            ADMIN: "ADMIN";
            SUPER_ADMIN: "SUPER_ADMIN";
        }>>;
        profileImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateEmployeeSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        phone: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        designation: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
        joiningDate: z.ZodOptional<z.ZodString>;
        salaryType: z.ZodOptional<z.ZodEnum<{
            MONTHLY: "MONTHLY";
            WEEKLY: "WEEKLY";
        }>>;
        profileImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateStatusSchema: z.ZodObject<{
    body: z.ZodObject<{
        status: z.ZodEnum<{
            ACTIVE: "ACTIVE";
            INACTIVE: "INACTIVE";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateRoleSchema: z.ZodObject<{
    body: z.ZodObject<{
        role: z.ZodEnum<{
            USER: "USER";
            ADMIN: "ADMIN";
            SUPER_ADMIN: "SUPER_ADMIN";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=employee.validator.d.ts.map