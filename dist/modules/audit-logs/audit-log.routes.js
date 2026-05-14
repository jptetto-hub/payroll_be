"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const audit_log_controller_1 = require("./audit-log.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), audit_log_controller_1.AuditLogController.list);
router.get("/user/:userId", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), audit_log_controller_1.AuditLogController.listByUser);
router.get("/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), audit_log_controller_1.AuditLogController.getById);
exports.default = router;
//# sourceMappingURL=audit-log.routes.js.map