"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAuditData = sanitizeAuditData;
const SENSITIVE_FIELDS = new Set([
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "jwt",
]);
const isDecimalLike = (value) => value &&
    typeof value === "object" &&
    typeof value.toString === "function" &&
    Array.isArray(value.d) &&
    typeof value.e === "number" &&
    typeof value.s === "number";
function sanitizeAuditData(data) {
    if (data === null) {
        return null;
    }
    if (typeof data === "bigint") {
        return Number(data);
    }
    if (typeof data === "function" || typeof data === "symbol") {
        return undefined;
    }
    if (typeof data !== "object") {
        return data;
    }
    if (data instanceof Date) {
        return data.toISOString();
    }
    if (isDecimalLike(data)) {
        return data.toString();
    }
    if (typeof data.toJSON === "function") {
        return sanitizeAuditData(data.toJSON());
    }
    if (Array.isArray(data)) {
        return data
            .map((item) => sanitizeAuditData(item))
            .filter((item) => item !== undefined);
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
            sanitized[key] = "[REDACTED]";
            continue;
        }
        const sanitizedValue = sanitizeAuditData(value);
        if (sanitizedValue !== undefined) {
            sanitized[key] = sanitizedValue;
        }
    }
    return sanitized;
}
//# sourceMappingURL=sanitize-audit-data.util.js.map