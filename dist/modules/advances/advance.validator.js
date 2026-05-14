"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAdvanceSchema = exports.cycleQuerySchema = exports.updateAdvanceSchema = exports.createAdvanceSchema = void 0;
const zod_1 = require("zod");
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateSchema = zod_1.z
    .string()
    .regex(dateOnlyRegex, "Date must be in YYYY-MM-DD format");
const amountSchema = zod_1.z.coerce
    .number("Amount must be a number")
    .positive("Amount must be greater than 0")
    .max(1000000, "Amount cannot exceed salary type");
exports.createAdvanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().uuid("Valid employeeId is required"),
        amount: amountSchema,
        date: dateSchema,
        deductionCycleStartDate: dateSchema,
        note: zod_1.z.string().max(250).optional(),
    }),
});
exports.updateAdvanceSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        amount: amountSchema.optional(),
        date: dateSchema.optional(),
        deductionCycleStartDate: dateSchema.optional(),
        note: zod_1.z.string().max(250).optional(),
        reason: zod_1.z.string().min(5, "Update reason is required").max(250),
    })
        .refine((data) => data.amount !== undefined ||
        data.date !== undefined ||
        data.deductionCycleStartDate !== undefined ||
        data.note !== undefined, {
        message: "At least one editable field is required",
    }),
});
exports.cycleQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        cycleStartDate: dateSchema,
        cycleEndDate: dateSchema,
    }),
});
exports.deleteAdvanceSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(5, "Delete reason is required").max(250),
    }),
});
//# sourceMappingURL=advance.validator.js.map