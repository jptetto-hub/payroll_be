"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const health_controller_1 = require("./health.controller");
const router = (0, express_1.Router)();
router.get("/system", health_controller_1.HealthController.system);
router.get("/queues", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), health_controller_1.HealthController.queues);
router.get("/workers", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), health_controller_1.HealthController.workers);
exports.default = router;
//# sourceMappingURL=health.routes.js.map