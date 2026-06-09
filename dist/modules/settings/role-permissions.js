"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRolePermissions = exports.configurablePermissionKeys = void 0;
exports.normalizeRolePermissions = normalizeRolePermissions;
exports.configurablePermissionKeys = [
    "DASHBOARD",
    "EMPLOYEES",
    "ATTENDANCE",
    "SALARY_HISTORY",
    "SALARY_CALCULATION",
    "ADVANCES",
    "PAYROLL",
    "PAYSLIPS",
    "LEDGER",
    "REPORTS",
    "AUDIT_LOGS",
    "SETTINGS",
];
exports.defaultRolePermissions = {
    ADMIN: {
        DASHBOARD: true,
        EMPLOYEES: true,
        ATTENDANCE: true,
        SALARY_HISTORY: true,
        SALARY_CALCULATION: true,
        ADVANCES: true,
        PAYROLL: true,
        PAYSLIPS: true,
        LEDGER: true,
        REPORTS: true,
        AUDIT_LOGS: true,
        SETTINGS: true,
    },
    USER: {
        DASHBOARD: true,
        EMPLOYEES: false,
        ATTENDANCE: true,
        SALARY_HISTORY: true,
        SALARY_CALCULATION: false,
        ADVANCES: true,
        PAYROLL: false,
        PAYSLIPS: true,
        LEDGER: true,
        REPORTS: false,
        AUDIT_LOGS: false,
        SETTINGS: false,
    },
};
const allowedRolePermissions = {
    ADMIN: Object.fromEntries(exports.configurablePermissionKeys.map((key) => [key, true])),
    USER: {
        ...exports.defaultRolePermissions.USER,
    },
};
function normalizeRolePermissions(value) {
    const input = value && typeof value === "object"
        ? value
        : {};
    return {
        ADMIN: normalizeRolePermission(input.ADMIN, exports.defaultRolePermissions.ADMIN, allowedRolePermissions.ADMIN),
        USER: normalizeRolePermission(input.USER, exports.defaultRolePermissions.USER, allowedRolePermissions.USER),
    };
}
function normalizeRolePermission(value, defaults, allowed) {
    return Object.fromEntries(exports.configurablePermissionKeys.map((key) => [
        key,
        allowed[key] && typeof value?.[key] === "boolean"
            ? value[key]
            : defaults[key],
    ]));
}
//# sourceMappingURL=role-permissions.js.map