"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalculatePayrollSchema = exports.deletePayrollSchema = exports.generatePayrollSchema = void 0;
const zod_1 = require("zod");
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
exports.generatePayrollSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().uuid("Valid employeeId is required"),
        periodStart: zod_1.z
            .string()
            .regex(dateOnlyRegex, "periodStart must be YYYY-MM-DD"),
        periodEnd: zod_1.z.string().regex(dateOnlyRegex, "periodEnd must be YYYY-MM-DD"),
    }),
});
exports.deletePayrollSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().max(250).optional(),
    }),
});
exports.recalculatePayrollSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(5, "Recalculation reason is required").max(250),
    }),
});
//# sourceMappingURL=payroll.validator.js.map