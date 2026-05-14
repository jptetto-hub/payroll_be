import { z } from "zod";
import { EmployeeStatus, Role, SalaryType } from "@prisma/client";

const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian mobile number");

const optionalEmailSchema = z
  .string()
  .email("Invalid email")
  .optional()
  .or(z.literal(""));

export const createEmployeeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    phone: phoneSchema,
    email: optionalEmailSchema,
    password: z.string().min(6).max(50),

    address: z.string().max(250).optional(),
    designation: z.string().min(2).max(80),
    department: z.string().min(2).max(80),
    joiningDate: z.string().datetime(),

    salaryType: z.nativeEnum(SalaryType),
    role: z.nativeEnum(Role).default(Role.USER),

    profileImage: z.string().url().optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    email: optionalEmailSchema,
    phone: phoneSchema.optional(),

    address: z.string().max(250).optional(),
    designation: z.string().min(2).max(80).optional(),
    department: z.string().min(2).max(80).optional(),
    joiningDate: z.string().datetime().optional(),

    salaryType: z.nativeEnum(SalaryType).optional(),
    profileImage: z.string().url().optional(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(EmployeeStatus),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(Role),
  }),
});
