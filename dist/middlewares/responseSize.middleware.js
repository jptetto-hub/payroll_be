"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseSizeMiddleware = responseSizeMiddleware;
const logger_1 = require("../config/logger");
function responseSizeMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        try {
            const sizeBytes = Buffer.byteLength(JSON.stringify(body));
            const warnSizeBytes = Number(process.env.RESPONSE_SIZE_WARN_BYTES || 500000);
            if (sizeBytes >= warnSizeBytes) {
                logger_1.logger.warn({
                    method: req.method,
                    path: req.originalUrl,
                    statusCode: res.statusCode,
                    sizeKB: `${(sizeBytes / 1024).toFixed(2)}KB`,
                }, "Large API response");
            }
        }
        catch {
            // Response-size logging must never break the actual response.
        }
        return originalJson(body);
    };
    next();
}
//# sourceMappingURL=responseSize.middleware.js.map