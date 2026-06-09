"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditMeta = getAuditMeta;
exports.runWithAuditContext = runWithAuditContext;
exports.getCurrentAuditMeta = getCurrentAuditMeta;
const async_hooks_1 = require("async_hooks");
const crypto_1 = require("crypto");
const audit_ip_util_1 = require("./audit-ip.util");
const auditContext = new async_hooks_1.AsyncLocalStorage();
function firstHeaderValue(value) {
    if (Array.isArray(value))
        return value[0];
    return value;
}
function getClientIp(req) {
    return (0, audit_ip_util_1.normalizeAuditIpAddress)(firstHeaderValue(req.headers["cf-connecting-ip"]) ||
        firstHeaderValue(req.headers["x-real-ip"]) ||
        firstHeaderValue(req.headers["x-forwarded-for"]) ||
        req.ip ||
        req.socket.remoteAddress);
}
function getDeviceInfo(userAgent) {
    if (!userAgent)
        return undefined;
    const browser = /Edg\//.test(userAgent)
        ? "Edge"
        : /Chrome\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
                ? "Safari"
                : /Firefox\//.test(userAgent)
                    ? "Firefox"
                    : "Unknown browser";
    const os = /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(userAgent)
            ? "macOS"
            : /Android/i.test(userAgent)
                ? "Android"
                : /iPhone|iPad|iOS/i.test(userAgent)
                    ? "iOS"
                    : /Linux/i.test(userAgent)
                        ? "Linux"
                        : "Unknown OS";
    return `${browser} on ${os}`;
}
function getAuditMeta(req) {
    const userAgent = firstHeaderValue(req.headers["user-agent"]);
    const requestId = firstHeaderValue(req.headers["x-request-id"]) ||
        firstHeaderValue(req.headers["x-correlation-id"]) ||
        (0, crypto_1.randomUUID)();
    const sessionId = firstHeaderValue(req.headers["x-session-id"]) ||
        firstHeaderValue(req.headers["x-client-session-id"]);
    const ipAddress = getClientIp(req);
    const deviceInfo = getDeviceInfo(userAgent);
    return {
        ...(ipAddress !== undefined && { ipAddress }),
        ...(userAgent !== undefined && { userAgent }),
        ...(deviceInfo !== undefined && { deviceInfo }),
        requestId,
        ...(sessionId !== undefined && { sessionId }),
        method: req.method,
        path: req.originalUrl || req.url,
    };
}
function runWithAuditContext(meta, callback) {
    return auditContext.run(meta, callback);
}
function getCurrentAuditMeta() {
    return auditContext.getStore();
}
//# sourceMappingURL=audit-context.js.map