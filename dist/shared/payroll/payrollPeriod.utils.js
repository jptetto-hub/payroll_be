"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectivePayrollPeriod = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
dayjs_1.default.extend(utc_1.default);
const getEffectivePayrollPeriod = ({ periodStart, periodEnd, joiningDate, }) => {
    const start = dayjs_1.default.utc(periodStart).startOf("day");
    const end = dayjs_1.default.utc(periodEnd).endOf("day");
    const joined = dayjs_1.default.utc(joiningDate).startOf("day");
    const effectiveStart = joined.isAfter(start, "day") ? joined : start;
    return {
        effectivePeriodStart: effectiveStart.toDate(),
        effectivePeriodEnd: end.toDate(),
        joinedDuringCycle: joined.isAfter(start, "day") && !joined.isAfter(end, "day"),
    };
};
exports.getEffectivePayrollPeriod = getEffectivePayrollPeriod;
//# sourceMappingURL=payrollPeriod.utils.js.map