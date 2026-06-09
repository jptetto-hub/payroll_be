"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequiredDateRange = parseRequiredDateRange;
const app_error_1 = require("../shared/utils/app-error");
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const parseDateStart = (value) => new Date(`${value}T00:00:00.000Z`);
const parseDateEnd = (value) => new Date(`${value}T23:59:59.999Z`);
function parseRequiredDateRange(query, maxDays = 31) {
    if (!query.from || !query.to) {
        throw new app_error_1.AppError("from and to date are required", 400);
    }
    const from = parseDateStart(String(query.from));
    const to = parseDateEnd(String(query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new app_error_1.AppError("Invalid from or to date. Use YYYY-MM-DD", 400);
    }
    if (from > to) {
        throw new app_error_1.AppError("from date cannot be greater than to date", 400);
    }
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
    if (diffDays > maxDays) {
        throw new app_error_1.AppError(`Date range cannot exceed ${maxDays} days`, 400);
    }
    return { from, to };
}
//# sourceMappingURL=reportValidation.js.map