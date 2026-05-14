"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const settings_controller_1 = require("./settings.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const settings_validator_1 = require("./settings.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), settings_controller_1.SettingsController.get);
router.patch("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validate)(settings_validator_1.updateSettingsSchema), settings_controller_1.SettingsController.update);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map