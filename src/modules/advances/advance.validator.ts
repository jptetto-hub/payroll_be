import { z } from "zod";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
  .string()
  .regex(dateOnlyRegex, "Date must be in YYYY-MM-DD format");

const optionalDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  dateSchema.optional(),
);

const amountSchema = z.coerce
  .number("Amount must be a number")
  .positive("Amount must be greater than 0")
  .max(1000000, "Amount cannot exceed 10,00,000");

export const createAdvanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Valid employeeId is required"),
    amount: amountSchema,
    date: dateSchema,
    deductionCycleStartDate: optionalDateSchema,
    note: z.string().max(250).optional(),
  }),
});

export const updateAdvanceSchema = z.object({
  body: z
    .object({
      amount: amountSchema.optional(),
      date: dateSchema.optional(),
      deductionCycleStartDate: optionalDateSchema,
      note: z.string().max(250).optional(),
      reason: z.string().min(5, "Update reason is required").max(250),
    })
    .refine(
      (data) =>
        data.amount !== undefined ||
        data.date !== undefined ||
        data.deductionCycleStartDate !== undefined ||
        data.note !== undefined,
      {
        message: "At least one editable field is required",
      },
    ),
});

export const cycleQuerySchema = z.object({
  query: z.object({
    cycleStartDate: dateSchema,
    cycleEndDate: dateSchema,
  }),
});

export const manualDeductionCycleQuerySchema = z.object({
  query: z.object({
    periodStart: dateSchema,
    periodEnd: dateSchema,
  }),
});

export const upsertManualDeductionSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Valid employeeId is required"),
    periodStart: dateSchema,
    periodEnd: dateSchema,
    amount: amountSchema,
    note: z.string().max(250).optional(),
  }),
});

export const advanceDeductionPreviewSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Valid employeeId is required"),
    amount: amountSchema,
    date: dateSchema,
    deductionCycleStartDate: dateSchema,
    excludeAdvanceId: z.string().uuid().optional(),
  }),
});

export const deleteAdvanceSchema = z.object({
  body: z.object({
    reason: z.string().min(5, "Delete reason is required").max(250),
  }),
});
