"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusinessDate = void 0;
const timezone_1 = require("../../config/timezone");
const getBusinessDate = (instant = new Date(), timezone = (0, timezone_1.getOrganizationTimezone)()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(instant);
    const read = (type) => Number(parts.find((part) => part.type === type)?.value);
    return new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
};
exports.getBusinessDate = getBusinessDate;
//# sourceMappingURL=business-date.util.js.map