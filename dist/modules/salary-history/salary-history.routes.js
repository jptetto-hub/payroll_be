"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const salary_history_controller_1 = require("./salary-history.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const salary_history_validator_1 = require("./salary-history.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(salary_history_validator_1.createSalaryHistorySchema), salary_history_controller_1.SalaryHistoryController.create);
router.get("/employee/:employeeId", (0, rbac_middleware_1.allowRoles)(client_1.Role.USER, client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), salary_history_controller_1.SalaryHistoryController.listByEmployee);
router.get("/employee/:employeeId/current", (0, rbac_middleware_1.allowRoles)(client_1.Role.USER, client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), salary_history_controller_1.SalaryHistoryController.current);
router.get("/employee/:employeeId/resolve", (0, rbac_middleware_1.allowRoles)(client_1.Role.USER, client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(salary_history_validator_1.resolveSalarySchema), salary_history_controller_1.SalaryHistoryController.resolve);
router.patch("/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(salary_history_validator_1.updateSalaryHistorySchema), salary_history_controller_1.SalaryHistoryController.update);
router.delete("/:id", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), salary_history_controller_1.SalaryHistoryController.delete);
exports.default = router;
//# sourceMappingURL=salary-history.routes.js.map