import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const generatePayrollSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Valid employeeId is required"),
    periodStart: z
      .string()
      .regex(dateOnlyRegex, "periodStart must be YYYY-MM-DD"),
    periodEnd: z.string().regex(dateOnlyRegex, "periodEnd must be YYYY-MM-DD"),
  }),
});

export const deletePayrollSchema = z.object({
  body: z.object({
    reason: z.string().max(250).optional(),
  }),
});

export const recalculatePayrollSchema = z.object({
  body: z.object({
    reason: z.string().min(5, "Recalculation reason is required").max(250),
  }),
});
