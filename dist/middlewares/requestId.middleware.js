"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = require("crypto");
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers["x-request-id"]?.toString() || (0, crypto_1.randomUUID)();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
}
//# sourceMappingURL=requestId.middleware.js.map