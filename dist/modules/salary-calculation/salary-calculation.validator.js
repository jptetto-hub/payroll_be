"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salaryCalculationPreviewSchema = void 0;
const zod_1 = require("zod");
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
exports.salaryCalculationPreviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().uuid("Valid employeeId is required"),
        periodStart: zod_1.z
            .string()
            .regex(dateOnlyRegex, "periodStart must be YYYY-MM-DD"),
        periodEnd: zod_1.z.string().regex(dateOnlyRegex, "periodEnd must be YYYY-MM-DD"),
    }),
});
//# sourceMappingURL=salary-calculation.validator.js.map