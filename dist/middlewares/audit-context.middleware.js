"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditContextMiddleware = auditContextMiddleware;
const audit_context_1 = require("../shared/audit/audit-context");
function auditContextMiddleware(req, res, next) {
    const meta = (0, audit_context_1.getAuditMeta)(req);
    if (meta.requestId) {
        res.setHeader("X-Request-Id", meta.requestId);
    }
    (0, audit_context_1.runWithAuditContext)(meta, next);
}
//# sourceMappingURL=audit-context.middleware.js.map