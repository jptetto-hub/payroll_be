"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSalarySchema = exports.updateSalaryHistorySchema = exports.createSalaryHistorySchema = void 0;
const zod_1 = require("zod");
exports.createSalaryHistorySchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().uuid("Valid employeeId is required"),
        salaryAmount: zod_1.z.coerce
            .number("Salary amount must be a number")
            .positive("Salary amount must be greater than 0")
            .max(10000000, "Salary amount is too high"),
        effectiveFrom: zod_1.z
            .string("Effective from date is required")
            .datetime("Effective from must be a valid ISO date"),
    }),
});
exports.updateSalaryHistorySchema = zod_1.z.object({
    body: zod_1.z
        .object({
        salaryAmount: zod_1.z.coerce
            .number()
            .positive("Salary amount must be greater than 0")
            .max(10000000, "Salary amount is too high")
            .optional(),
        effectiveFrom: zod_1.z
            .string()
            .datetime("Effective from must be a valid ISO date")
            .optional(),
        correctionReason: zod_1.z
            .string()
            .min(5, "Correction reason is required")
            .max(250),
    })
        .refine((data) => data.salaryAmount !== undefined || data.effectiveFrom !== undefined, {
        message: "At least salaryAmount or effectiveFrom is required",
    }),
});
exports.resolveSalarySchema = zod_1.z.object({
    query: zod_1.z.object({
        date: zod_1.z.string().min(1, "Date is required"),
    }),
});
//# sourceMappingURL=salary-history.validator.js.map