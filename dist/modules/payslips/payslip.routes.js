"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const payslip_controller_1 = require("./payslip.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN, client_1.Role.USER), payslip_controller_1.PayslipController.list);
router.get("/my", (0, rbac_middleware_1.allowRoles)(client_1.Role.USER), payslip_controller_1.PayslipController.my);
router.get("/payroll/:payrollId", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), payslip_controller_1.PayslipController.getByPayroll);
router.get("/employee/:employeeId", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), payslip_controller_1.PayslipController.listByEmployee);
router.post("/:id/retry", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), payslip_controller_1.PayslipController.retryGeneration);
router.get("/:id", payslip_controller_1.PayslipController.getById);
exports.default = router;
//# sourceMappingURL=payslip.routes.js.map