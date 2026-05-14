"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const employee_controller_1 = require("./employee.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const employee_validator_1 = require("./employee.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(employee_validator_1.createEmployeeSchema), employee_controller_1.EmployeeController.create);
router.get("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), employee_controller_1.EmployeeController.list);
router.get("/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), employee_controller_1.EmployeeController.getById);
router.patch("/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(employee_validator_1.updateEmployeeSchema), employee_controller_1.EmployeeController.update);
router.patch("/:id/status", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(employee_validator_1.updateStatusSchema), employee_controller_1.EmployeeController.updateStatus);
router.patch("/:id/role", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(employee_validator_1.updateRoleSchema), employee_controller_1.EmployeeController.updateRole);
exports.default = router;
//# sourceMappingURL=employee.routes.js.map