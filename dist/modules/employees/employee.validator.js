"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoleSchema = exports.updateStatusSchema = exports.updateEmployeeSchema = exports.createEmployeeSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const phoneSchema = zod_1.z
    .string()
    .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian mobile number");
const optionalEmailSchema = zod_1.z
    .string()
    .email("Invalid email")
    .optional()
    .or(zod_1.z.literal(""));
exports.createEmployeeSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(80),
        phone: phoneSchema,
        email: optionalEmailSchema,
        password: zod_1.z.string().min(6).max(50),
        address: zod_1.z.string().max(250).optional(),
        designation: zod_1.z.string().min(2).max(80),
        department: zod_1.z.string().min(2).max(80),
        joiningDate: zod_1.z.string().datetime(),
        salaryType: zod_1.z.nativeEnum(client_1.SalaryType),
        role: zod_1.z.nativeEnum(client_1.Role).default(client_1.Role.USER),
        profileImage: zod_1.z.string().url().optional(),
    }),
});
exports.updateEmployeeSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(80).optional(),
        email: optionalEmailSchema,
        phone: phoneSchema.optional(),
        address: zod_1.z.string().max(250).optional(),
        designation: zod_1.z.string().min(2).max(80).optional(),
        department: zod_1.z.string().min(2).max(80).optional(),
        joiningDate: zod_1.z.string().datetime().optional(),
        salaryType: zod_1.z.nativeEnum(client_1.SalaryType).optional(),
        profileImage: zod_1.z.string().url().optional(),
    }),
});
exports.updateStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(client_1.EmployeeStatus),
    }),
});
exports.updateRoleSchema = zod_1.z.object({
    body: zod_1.z.object({
        role: zod_1.z.nativeEnum(client_1.Role),
    }),
});
//# sourceMappingURL=employee.validator.js.map