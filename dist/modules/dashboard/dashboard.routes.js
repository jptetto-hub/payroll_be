"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("./dashboard.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/summary", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.summary);
router.get("/recent-payroll", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.recentPayroll);
router.get("/recent-activities", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.recentActivities);
router.get("/analytics", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.analytics);
router.get("/", auth_middleware_1.authMiddleware, dashboard_controller_1.DashboardController.summary);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map