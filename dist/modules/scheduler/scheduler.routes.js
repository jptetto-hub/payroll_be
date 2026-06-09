"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const scheduler_controller_1 = require("./scheduler.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const rateLimit_middleware_1 = require("../../middlewares/rateLimit.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/manual-advance-reminders", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.manualAdvanceReminders);
router.post("/run", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), rateLimit_middleware_1.sensitiveActionRateLimiter, scheduler_controller_1.SchedulerController.runPayroll);
router.post("/run-payroll", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), rateLimit_middleware_1.sensitiveActionRateLimiter, scheduler_controller_1.SchedulerController.runPayroll);
router.get("/runs", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.runs);
router.get("/runs/:id/items", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.runItems);
router.get("/runs/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.runStatus);
exports.default = router;
//# sourceMappingURL=scheduler.routes.js.map