"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWeeklyPayrollCycle = exports.isValidWeeklyCycle = exports.getWeeklyCycleEnd = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const client_1 = require("@prisma/client");
const app_error_1 = require("../utils/app-error");
dayjs_1.default.extend(utc_1.default);
const WEEKLY_PAYROLL_ERROR = "Weekly payroll must be a valid week cycle ending on Saturday";
const getWeeklyCycleEnd = (cycleStartDate) => {
    return dayjs_1.default.utc(cycleStartDate).day(6).endOf("day").toDate();
};
exports.getWeeklyCycleEnd = getWeeklyCycleEnd;
const isValidWeeklyCycle = (periodStart, periodEnd, weekStartsOn) => {
    const start = dayjs_1.default.utc(periodStart).startOf("day");
    const end = dayjs_1.default.utc(periodEnd).startOf("day");
    const expectedStartDay = weekStartsOn === client_1.WeekStartsOn.MONDAY ? 1 : 0;
    const expectedEndDay = 6;
    return start.day() === expectedStartDay && end.day() === expectedEndDay;
};
exports.isValidWeeklyCycle = isValidWeeklyCycle;
const validateWeeklyPayrollCycle = (periodStart, periodEnd, weekStartsOn) => {
    const start = dayjs_1.default.utc(periodStart).startOf("day");
    const end = dayjs_1.default.utc(periodEnd).startOf("day");
    const expectedEnd = dayjs_1.default.utc(periodStart).day(6).startOf("day");
    if (!(0, exports.isValidWeeklyCycle)(start.toDate(), end.toDate(), weekStartsOn)) {
        throw new app_error_1.AppError(WEEKLY_PAYROLL_ERROR, 400);
    }
    if (!end.isSame(expectedEnd, "day")) {
        throw new app_error_1.AppError(WEEKLY_PAYROLL_ERROR, 400);
    }
    return {
        periodStart: start.toDate(),
        periodEnd: end.endOf("day").toDate(),
    };
};
exports.validateWeeklyPayrollCycle = validateWeeklyPayrollCycle;
//# sourceMappingURL=payrollCycle.utils.js.map