"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestTimingMiddleware = requestTimingMiddleware;
const logger_1 = require("../config/logger");
function requestTimingMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
        const endedAt = process.hrtime.bigint();
        const durationMs = Number(endedAt - startedAt) / 1_000_000;
        const slowApiMs = Number(process.env.SLOW_API_MS || 1000);
        const logPayload = {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            userId: req.user?.id,
            role: req.user?.role,
        };
        if (durationMs >= slowApiMs) {
            logger_1.logger.warn(logPayload, "Slow API request");
        }
        else if (process.env.LOG_API_REQUESTS === "true") {
            logger_1.logger.info(logPayload, "API request completed");
        }
    });
    next();
}
//# sourceMappingURL=requestTiming.middleware.js.map