"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const salary_calculation_controller_1 = require("./salary-calculation.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const salary_calculation_validator_1 = require("./salary-calculation.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post("/preview", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(salary_calculation_validator_1.salaryCalculationPreviewSchema), salary_calculation_controller_1.SalaryCalculationController.preview);
exports.default = router;
//# sourceMappingURL=salary-calculation.routes.js.map