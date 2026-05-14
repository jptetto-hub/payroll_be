"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkingDatesBetween = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
dayjs_1.default.extend(utc_1.default);
const getWorkingDatesBetween = (from, to) => {
    const dates = [];
    let cursor = dayjs_1.default.utc(from).startOf("day");
    const end = dayjs_1.default.utc(to).startOf("day");
    while (cursor.isSame(end, "day") || cursor.isBefore(end, "day")) {
        if (cursor.day() !== 0) {
            dates.push(cursor.format("YYYY-MM-DD"));
        }
        cursor = cursor.add(1, "day");
    }
    return dates;
};
exports.getWorkingDatesBetween = getWorkingDatesBetween;
//# sourceMappingURL=payrollDate.utils.js.map