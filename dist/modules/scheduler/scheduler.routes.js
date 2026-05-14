"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const scheduler_controller_1 = require("./scheduler.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post("/run-payroll", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.runPayroll);
router.get("/runs", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), scheduler_controller_1.SchedulerController.runs);
exports.default = router;
//# sourceMappingURL=scheduler.routes.js.map