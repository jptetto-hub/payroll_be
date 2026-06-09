"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z
            .string()
            .regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian phone number is required"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    }),
});
//# sourceMappingURL=auth.validator.js.map