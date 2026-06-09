"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const dashboard_controller_1 = require("./dashboard.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const cacheHeaders_middleware_1 = require("../../middlewares/cacheHeaders.middleware");
const router = (0, express_1.Router)();
router.post("/summary/refresh", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), dashboard_controller_1.DashboardController.refreshSummary);
router.get("/summary", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN, client_1.Role.USER), (0, cacheHeaders_middleware_1.cacheForSeconds)(30), dashboard_controller_1.DashboardController.summary);
router.get("/recent-payroll", auth_middleware_1.authMiddleware, (0, cacheHeaders_middleware_1.cacheForSeconds)(30), dashboard_controller_1.DashboardController.recentPayroll);
router.get("/recent-activities", auth_middleware_1.authMiddleware, (0, cacheHeaders_middleware_1.cacheForSeconds)(30), dashboard_controller_1.DashboardController.recentActivities);
router.get("/analytics", auth_middleware_1.authMiddleware, (0, cacheHeaders_middleware_1.cacheForSeconds)(60), dashboard_controller_1.DashboardController.analytics);
router.get("/", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.summary);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map