"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        weekStartsOn: zod_1.z.nativeEnum(client_1.WeekStartsOn).optional(),
        monthlyPayrollDay: zod_1.z.number().int().min(1).max(31).nullable().optional(),
        autoPayrollEnabled: zod_1.z.boolean().optional(),
    }),
});
//# sourceMappingURL=settings.validator.js.map