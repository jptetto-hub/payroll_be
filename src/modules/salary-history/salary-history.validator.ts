import { z } from "zod";

export const createSalaryHistorySchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Valid employeeId is required"),
    salaryAmount: z.coerce
      .number("Salary amount must be a number")
      .positive("Salary amount must be greater than 0")
      .max(10000000, "Salary amount is too high"),
    effectiveFrom: z
      .string("Effective from date is required")
      .datetime("Effective from must be a valid ISO date"),
  }),
});

export const updateSalaryHistorySchema = z.object({
  body: z
    .object({
      salaryAmount: z.coerce
        .number()
        .positive("Salary amount must be greater than 0")
        .max(10000000, "Salary amount is too high")
        .optional(),
      effectiveFrom: z
        .string()
        .datetime("Effective from must be a valid ISO date")
        .optional(),
      correctionReason: z
        .string()
        .min(5, "Correction reason is required")
        .max(250),
    })
    .refine(
      (data) =>
        data.salaryAmount !== undefined || data.effectiveFrom !== undefined,
      {
        message: "At least salaryAmount or effectiveFrom is required",
      },
    ),
});

export const resolveSalarySchema = z.object({
  query: z.object({
    date: z.string().min(1, "Date is required"),
  }),
});
