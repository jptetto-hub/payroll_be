"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfiguredTimezone = exports.setOrganizationTimezone = exports.getOrganizationTimezone = exports.APP_TIMEZONE = exports.getValidTimezone = void 0;
const getValidTimezone = (value, fallback) => {
    const timezone = value || fallback;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
        return timezone;
    }
    catch {
        throw new Error(`Invalid IANA timezone: ${timezone}`);
    }
};
exports.getValidTimezone = getValidTimezone;
exports.APP_TIMEZONE = (0, exports.getValidTimezone)(process.env.APP_TIMEZONE, "UTC");
let organizationTimezone = exports.APP_TIMEZONE;
const getOrganizationTimezone = () => organizationTimezone;
exports.getOrganizationTimezone = getOrganizationTimezone;
const setOrganizationTimezone = (timezone) => {
    organizationTimezone = (0, exports.getValidTimezone)(timezone, exports.APP_TIMEZONE);
    return organizationTimezone;
};
exports.setOrganizationTimezone = setOrganizationTimezone;
const getConfiguredTimezone = (value) => (0, exports.getValidTimezone)(value, (0, exports.getOrganizationTimezone)());
exports.getConfiguredTimezone = getConfiguredTimezone;
//# sourceMappingURL=timezone.js.map